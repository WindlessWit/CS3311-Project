<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

require __DIR__ . "/../db_config.php";

$page     = isset($_GET["page"]) ? max(1, intval($_GET["page"])) : 1;
$pageSize = isset($_GET["pageSize"]) ? max(1, intval($_GET["pageSize"])) : 5;
$search   = isset($_GET["q"]) ? trim($_GET["q"]) : "";

$offset = ($page - 1) * $pageSize;

$where = "";
$params = [];

if ($search !== "") {
    $where = "WHERE 
                name LIKE :search OR 
                email LIKE :search OR 
                phone LIKE :search OR 
                service LIKE :search OR 
                details LIKE :search";
    $params[':search'] = "%" . $search . "%";
}

// Count total rows
$countSql = "SELECT COUNT(*) FROM quote_requests $where";
$countStmt = $pdo->prepare($countSql);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// Fetch paginated rows
$dataSql = "
    SELECT id, name, email, phone, service, details, submitted_at
    FROM quote_requests
    $where
    ORDER BY submitted_at DESC
    LIMIT :limit OFFSET :offset
";
$dataStmt = $pdo->prepare($dataSql);

foreach ($params as $key => $value) {
    $dataStmt->bindValue($key, $value, PDO::PARAM_STR);
}

$dataStmt->bindValue(":limit", $pageSize, PDO::PARAM_INT);
$dataStmt->bindValue(":offset", $offset, PDO::PARAM_INT);

$dataStmt->execute();

$rows = $dataStmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    "page"       => $page,
    "pageSize"   => $pageSize,
    "totalCount" => $total,
    "totalPages" => max(1, ceil($total / $pageSize)),
    "requests"   => $rows
]);
?>
