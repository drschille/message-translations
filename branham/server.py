#!/usr/bin/env python3
"""
Branham Sermon App - Local Server with Search API
Kjører en lokal webserver med søk i paragrafer.
"""

import http.server
import socketserver
import json
import os
import re
import sys
import urllib.parse
from pathlib import Path

# Configuration
PORT = 8000
SERMONS_FILE = "sermons.json"
PARAGRAPHS_DIR = "paragraphs"

# Global data store
sermons = []
sermons_by_id = {}
paragraphs = {}  # sid -> list of paragraphs
search_index = []  # Flat list for searching

def clean_text(text):
    """Clean up escaped characters in text"""
    if not text:
        return text
    # Fix escaped quotes
    text = text.replace("\\'", "'")
    text = text.replace('\\"', '"')
    text = text.replace("\\n", "\n")
    text = text.replace("\\r", "")
    return text

def load_data():
    """Load all data into memory for fast searching"""
    global sermons, sermons_by_id, paragraphs, search_index
    
    print("Loading data...")
    
    # Load sermons
    with open(SERMONS_FILE, 'r', encoding='utf-8') as f:
        sermons = json.load(f)
    
    sermons_by_id = {s['sid']: s for s in sermons}
    print(f"  Loaded {len(sermons)} sermons")
    
    # Load all paragraphs
    para_count = 0
    for filename in os.listdir(PARAGRAPHS_DIR):
        if filename.endswith('.json'):
            sid = int(filename.replace('.json', ''))
            filepath = os.path.join(PARAGRAPHS_DIR, filename)
            
            with open(filepath, 'r', encoding='utf-8') as f:
                paras = json.load(f)
                paragraphs[sid] = paras
                
                # Add to search index
                for para in paras:
                    clean = clean_text(para['text'])
                    para['text'] = clean  # Update the stored text too
                    search_index.append({
                        'sid': sid,
                        'paragraphID': para['paragraphID'],
                        'text': clean,
                        'text_lower': clean.lower()
                    })
                    para_count += 1
    
    print(f"  Loaded {para_count} paragraphs")
    print("Data loaded and indexed!")

def search_paragraphs(query, limit=50, search_type='exact'):
    """Search paragraphs for a query string"""
    query_lower = query.lower()
    
    results = []
    seen_contexts = set()  # Avoid duplicate contexts
    
    for item in search_index:
        match = False
        
        if search_type == 'exact':
            # Exact phrase match
            match = query_lower in item['text_lower']
        else:
            # All words must be present (but not necessarily together)
            words = query_lower.split()
            match = all(word in item['text_lower'] for word in words)
        
        if match:
            sid = item['sid']
            sermon = sermons_by_id.get(sid, {})
            
            # Create context key to avoid near-duplicates
            context_key = f"{sid}-{item['paragraphID']}"
            if context_key in seen_contexts:
                continue
            seen_contexts.add(context_key)
            
            # Highlight matches in text
            highlighted = item['text']
            if search_type == 'exact':
                pattern = re.compile(re.escape(query), re.IGNORECASE)
                highlighted = pattern.sub(f'<mark>\\g<0></mark>', highlighted)
            else:
                words = query_lower.split()
                for word in words:
                    pattern = re.compile(re.escape(word), re.IGNORECASE)
                    highlighted = pattern.sub(f'<mark>\\g<0></mark>', highlighted)
            
            results.append({
                'sid': sid,
                'paragraphID': item['paragraphID'],
                'text': item['text'],
                'highlighted': highlighted,
                'sermon': {
                    'title': sermon.get('title', ''),
                    'date': sermon.get('date', ''),
                    'location': sermon.get('location', ''),
                    'tag': sermon.get('tag', '')
                }
            })
            
            if len(results) >= limit:
                break
    
    return results

def count_occurrences(query, search_type='exact'):
    """Count total occurrences of a query"""
    query_lower = query.lower()
    
    total_paragraphs = 0
    sermon_ids = set()
    
    for item in search_index:
        match = False
        
        if search_type == 'exact':
            match = query_lower in item['text_lower']
        else:
            words = query_lower.split()
            match = all(word in item['text_lower'] for word in words)
        
        if match:
            total_paragraphs += 1
            sermon_ids.add(item['sid'])
    
    return {
        'paragraphs': total_paragraphs,
        'sermons': len(sermon_ids)
    }

class APIHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler with API endpoints"""
    
    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            query_params = urllib.parse.parse_qs(parsed.query)
            
            # API: Search paragraphs
            if path == '/api/search':
                query = query_params.get('q', [''])[0]
                limit = int(query_params.get('limit', ['50'])[0])
                search_type = query_params.get('type', ['exact'])[0]
                
                if not query or len(query) < 2:
                    self.send_json({'error': 'Query too short', 'results': []})
                    return
                
                results = search_paragraphs(query, limit, search_type)
                counts = count_occurrences(query, search_type)
                
                self.send_json({
                    'query': query,
                    'type': search_type,
                    'counts': counts,
                    'results': results
                })
                return
            
            # API: Get sermon list
            if path == '/api/sermons':
                self.send_json(sermons)
                return
            
            # API: Get paragraphs for a sermon
            if path.startswith('/api/paragraphs/'):
                try:
                    sid = int(path.split('/')[-1])
                    paras = paragraphs.get(sid, [])
                    self.send_json(paras)
                except ValueError:
                    self.send_json({'error': 'Invalid sermon ID'})
                return
            
            # Serve static files
            return super().do_GET()
        
        except Exception as e:
            print(f"Error handling request {self.path}: {e}")
            self.send_error(500, str(e))
    
    def send_json(self, data):
        """Send JSON response"""
        try:
            response = json.dumps(data, ensure_ascii=False)
            response_bytes = response.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', len(response_bytes))
            self.end_headers()
            self.wfile.write(response_bytes)
        except Exception as e:
            print(f"Error sending JSON: {e}")
    
    def log_message(self, format, *args):
        """Custom log format"""
        if '/api/' in args[0]:
            print(f"API: {args[0]}")

def main():
    # Get port from command line or use default
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    
    # Check files exist
    if not os.path.exists(SERMONS_FILE):
        print(f"Error: {SERMONS_FILE} not found")
        print("Run 'python3 convert_to_json.py' first")
        return
    
    if not os.path.exists(PARAGRAPHS_DIR):
        print(f"Error: {PARAGRAPHS_DIR}/ not found")
        print("Run 'python3 convert_to_json.py' first")
        return
    
    # Load data
    load_data()
    
    # Start server with address reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), APIHandler) as httpd:
        print(f"\n🚀 Server running at http://localhost:{port}")
        print("   Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down...")

if __name__ == "__main__":
    main()
