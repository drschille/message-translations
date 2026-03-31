<?php
/**
 * Branham Sermon Search API
 * MySQL version - much faster!
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Clean text from markdown artifacts
function cleanText($text) {
    if (!$text) return '';
    $text = preg_replace('/#{1,6}\s*/m', '', $text);     // Remove # ## ### #### etc anywhere
    $text = preg_replace('/%%%/', '', $text);            // Remove %%% dividers
    $text = preg_replace('/\*\*\*([^*]+)\*\*\*/', '$1', $text);  // Remove ***bold italic***
    $text = preg_replace('/\*\*([^*]+)\*\*/', '$1', $text);  // Remove **bold**
    $text = preg_replace('/\*([^*]+)\*/', '$1', $text);      // Remove *italic*
    $text = preg_replace('/__([^_]+)__/', '$1', $text);      // Remove __bold__
    $text = preg_replace('/_([^_]+)_/', '$1', $text);        // Remove _italic_
    $text = preg_replace('/@/', '', $text);              // Remove @ symbols
    $text = str_replace('\\"', '"', $text);              // Replace \" with "
    $text = str_replace("\\'", "'", $text);              // Replace \' with '
    return trim($text);
}

// Database configuration
$DB_HOST = 'branhamno01.mysql.domeneshop.no';
$DB_NAME = 'branhamno01';
$DB_USER = 'x1_branhamno01';
$DB_PASS = 'Get-222-xyz-Conch-glenn';
$DB_PREFIX = 'wpbranham_'; // Table prefix

// Connect to database
try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Get request path
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$base_path = dirname($_SERVER['SCRIPT_NAME']);
if ($base_path !== '/') {
    $path = str_replace($base_path, '', $path);
}

// Route: /api/sermons
if ($path === '/api/sermons' || $path === '/api.php/sermons') {
    $stmt = $pdo->query("
        SELECT 
            sid,
            originaltitle as title,
            stitle as title_no,
            sdate as date,
            location,
            sdatecust as tag
        FROM {$DB_PREFIX}sermons
        WHERE sid IN (SELECT DISTINCT sid FROM {$DB_PREFIX}sermonsparas)
        ORDER BY sdate DESC
    ");
    
    $sermons = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($sermons);
    exit;
}

// Route: /api/paragraphs/{sid}
if (preg_match('/\/api(?:\.php)?\/paragraphs\/(\d+)/', $path, $matches)) {
    $sid = intval($matches[1]);
    
    $stmt = $pdo->prepare("
        SELECT 
            paragraphID,
            englishparagraph as text,
            norwegianparagraph as text_no
        FROM {$DB_PREFIX}sermonsparas
        WHERE sid = ?
        ORDER BY paragraphID
    ");
    $stmt->execute([$sid]);
    
    $paragraphs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($paragraphs);
    exit;
}

// Route: /api/search
if ($path === '/api/search' || $path === '/api.php/search') {
    $query = isset($_GET['q']) ? $_GET['q'] : '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
    $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
    $search_type = isset($_GET['type']) ? $_GET['type'] : 'exact';
    $lang = isset($_GET['lang']) ? $_GET['lang'] : 'en';
    $skip_count = isset($_GET['skip_count']) ? true : false;
    
    if (strlen($query) < 2) {
        echo json_encode(['error' => 'Query too short', 'results' => []]);
        exit;
    }
    
    // Choose which column to search
    $text_column = $lang === 'no' ? 'norwegianparagraph' : 'englishparagraph';
    
    $search_words = preg_split('/\s+/', trim($query));
    $word_count = count($search_words);
    
    // Check if query contains punctuation that FULLTEXT can't handle
    $has_punctuation = preg_match('/[^\p{L}\p{N}\s]/u', $query);
    
    // Find longest word for FULLTEXT (short words are ignored by MySQL)
    $longest_word = '';
    foreach ($search_words as $word) {
        // Strip punctuation for length comparison
        $clean_word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
        if (mb_strlen($clean_word) > mb_strlen(preg_replace('/[^\p{L}\p{N}]/u', '', $longest_word))) {
            $longest_word = $clean_word;
        }
    }
    
    // Optimize: single word without punctuation = direct FULLTEXT, no filtering
    $single_word_search = ($word_count === 1 && !$has_punctuation && mb_strlen($longest_word) >= 3);
    
    // Use LIKE for exact phrase searches (more accurate), FULLTEXT for all-words
    if ($search_type === 'exact') {
        // Exact phrase - use LIKE for speed, verify word boundaries in PHP
        // This is much faster than REGEXP on the full phrase
        $where_clause = "$text_column LIKE ?";
        $params = ['%' . $query . '%'];
        $verify_phrase = true; // Will verify word boundaries in PHP
        $verify_all_words = false;
    } else if (mb_strlen($longest_word) >= 4) {
        // All words with long enough word - use FULLTEXT + filtering
        $where_clause = "MATCH($text_column) AGAINST(? IN BOOLEAN MODE)";
        $params = [$longest_word];
        // Single word = no filtering needed
        $verify_phrase = false;
        $verify_all_words = $single_word_search ? false : true;
    } else {
        // All words are short (3 chars or less) - use REGEXP for whole word matching
        $regexp_conditions = [];
        foreach ($search_words as $word) {
            $clean_word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
            if (mb_strlen($clean_word) > 0) {
                // MySQL REGEXP for word boundary: [[:<:]] and [[:>:]]
                $escaped = preg_replace('/[.*+?^${}()|[\]\\\\]/', '\\\\$0', $clean_word);
                $regexp_conditions[] = "$text_column REGEXP '[[:<:]]" . $escaped . "[[:>:]]'";
            }
        }
        if (count($regexp_conditions) > 0) {
            $where_clause = implode(' AND ', $regexp_conditions);
            $params = [];
        } else {
            $where_clause = "1=0"; // No valid words
            $params = [];
        }
        $verify_phrase = false;
        $verify_all_words = false;
    }
    
    // Fetch limit - less for single words (no filtering), more for multi-word
    $fetch_limit = ($verify_phrase || $verify_all_words) ? ($limit + 1) * 5 : $limit + 1;
    
    // Get results with sermon info, sorted by date (newest first)
    $search_sql = "
        SELECT 
            p.sid,
            p.paragraphID,
            p.englishparagraph as text,
            p.norwegianparagraph as text_no,
            s.originaltitle as title,
            s.stitle as title_no,
            s.sdate as date,
            s.location,
            s.sdatecust as tag
        FROM {$DB_PREFIX}sermonsparas p
        JOIN {$DB_PREFIX}sermons s ON p.sid = s.sid
        WHERE $where_clause
        ORDER BY s.sdate DESC, p.paragraphID ASC
        LIMIT $fetch_limit OFFSET $offset
    ";
    
    $stmt = $pdo->prepare($search_sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Filter results for accuracy (FULLTEXT only searched longest word)
    $filtered_rows = [];
    // Norwegian-aware word boundary pattern
    $word_start = '(?<![\\p{L}\\p{N}])';
    $word_end = '(?![\\p{L}\\p{N}])';
    
    foreach ($rows as $row) {
        $text = $lang === 'no' && !empty($row['text_no']) ? $row['text_no'] : $row['text'];
        
        if ($verify_phrase) {
            // Exact phrase - must contain exact phrase with word boundaries
            $pattern = '/' . $word_start . preg_quote($query, '/') . $word_end . '/iu';
            if (preg_match($pattern, $text)) {
                $filtered_rows[] = $row;
            }
        } else if ($verify_all_words) {
            // All words - each word must be present as whole word
            $all_found = true;
            foreach ($search_words as $word) {
                $clean_word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
                if (mb_strlen($clean_word) > 0) {
                    $pattern = '/' . $word_start . preg_quote($clean_word, '/') . $word_end . '/iu';
                    if (!preg_match($pattern, $text)) {
                        $all_found = false;
                        break;
                    }
                }
            }
            if ($all_found) {
                $filtered_rows[] = $row;
            }
        } else {
            $filtered_rows[] = $row;
        }
    }
    $rows = $filtered_rows;
    
    // Check if there are more results and trim to limit
    $has_more = count($rows) > $limit;
    $rows = array_slice($rows, 0, $limit);
    
    // Format results with highlighting
    $results = [];
    // Norwegian-aware word boundary pattern for highlighting
    $hl_word_start = '(?<![\\p{L}\\p{N}])';
    $hl_word_end = '(?![\\p{L}\\p{N}])';
    
    foreach ($rows as $row) {
        $text = $lang === 'no' && !empty($row['text_no']) ? $row['text_no'] : $row['text'];
        $text = cleanText($text);
        
        // Highlight matches - use word boundaries
        $highlighted = $text;
        if ($search_type === 'exact') {
            // Highlight exact phrase with word boundaries
            $highlighted = preg_replace(
                '/' . $hl_word_start . '(' . preg_quote($query, '/') . ')' . $hl_word_end . '/iu',
                '<mark>$1</mark>',
                $text
            );
        } else {
            // Highlight each word with word boundaries
            foreach ($search_words as $word) {
                $clean_word = preg_replace('/[^\p{L}\p{N}]/u', '', $word);
                if (mb_strlen($clean_word) > 0) {
                    $highlighted = preg_replace(
                        '/' . $hl_word_start . '(' . preg_quote($clean_word, '/') . ')' . $hl_word_end . '/iu',
                        '<mark>$1</mark>',
                        $highlighted
                    );
                }
            }
        }
        
        $results[] = [
            'sid' => intval($row['sid']),
            'paragraphID' => intval($row['paragraphID']),
            'text' => $row['text'] ?? '',
            'text_no' => $row['text_no'] ?? '',
            'highlighted' => $highlighted,
            'sermon' => [
                'title' => $row['title'] ?? '',
                'title_no' => $row['title_no'] ?? '',
                'date' => $row['date'] ?? '',
                'location' => $row['location'] ?? '',
                'tag' => $row['tag'] ?? ''
            ]
        ];
    }
    
    // Count unique sermons in filtered results
    $sermon_ids = array_unique(array_column($results, 'sid'));
    $filtered_paragraph_count = count($results);
    $filtered_sermon_count = count($sermon_ids);
    
    echo json_encode([
        'query' => $query,
        'type' => $search_type,
        'lang' => $lang,
        'counts' => [
            'paragraphs' => $filtered_paragraph_count,
            'sermons' => $filtered_sermon_count,
            'has_more_estimate' => $has_more // indicates if there might be more
        ],
        'pagination' => [
            'offset' => $offset,
            'limit' => $limit,
            'total' => $filtered_paragraph_count,
            'has_more' => $has_more
        ],
        'results' => $results
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Default: show API info
echo json_encode([
    'name' => 'Branham Sermon Search API',
    'version' => '2.0 (MySQL)',
    'endpoints' => [
        '/api/sermons' => 'Get all sermons',
        '/api/paragraphs/{sid}' => 'Get paragraphs for a sermon',
        '/api/search?q={query}&type={exact|words}&lang={en|no}&limit={n}&offset={n}' => 'Search paragraphs'
    ]
]);
