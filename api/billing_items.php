<?php
// billing_items.php
// Search existing items/services for Billing (used by "My Items" / autocomplete)

header('Content-Type: application/json');

$host = "localhost";
$user = "root";
$pass = "";  // change if needed
$db   = "construction_solutions";

$mysqli = new mysqli($host, $user, $pass, $db);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$q = "";
if (isset($_GET['q'])) {
    $q = trim($_GET['q']);
}

// If no q: return all items. If q: match name or description.
if ($q === "") {
    $sql = "SELECT id, name, description, default_rate
            FROM items
            ORDER BY name ASC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to prepare query"]);
        exit;
    }
} else {
    $sql = "SELECT id, name, description, default_rate
            FROM items
            WHERE LOWER(name)        LIKE ?
               OR LOWER(description) LIKE ?
            ORDER BY name ASC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to prepare query"]);
        exit;
    }

    $like = '%' . strtolower($q) . '%';
    $stmt->bind_param('ss', $like, $like);
}

$stmt->execute();
$result = $stmt->get_result();

$items = [];
while ($row = $result->fetch_assoc()) {
    $items[] = [
        "id"           => (int)$row["id"],
        "name"         => $row["name"],
        "description"  => $row["description"],
        "default_rate" => (float)$row["default_rate"],
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode([
    "results" => $items
]);
