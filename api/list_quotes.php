<?php
// api/list_quotes.php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/../db_config.php';

try {
    // For now we show only non-converted, non-cancelled quotes
    $sql = "
        SELECT
            q.id,
            q.client_id,
            q.status,
            q.notes,
            q.title,
            q.created_at,
            c.name AS client_name,
            COALESCE(SUM(qi.line_total), 0) AS total
        FROM quotes q
        JOIN clients c ON c.id = q.client_id
        LEFT JOIN quote_items qi ON qi.quote_id = q.id
        WHERE q.status IN ('draft', 'issued')
        GROUP BY
            q.id,
            q.client_id,
            q.status,
            q.notes,
            q.title,
            q.created_at,
            c.name
        ORDER BY q.created_at DESC
    ";

    $stmt = $pdo->query($sql);
    $quotes = $stmt->fetchAll();

    echo json_encode([
        'results' => $quotes,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to load quotes.']);
}
