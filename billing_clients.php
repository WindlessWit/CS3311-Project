<?php
// billing_clients.php
// Search existing clients for Billing (used by "My Clients" / autocomplete)

header('Content-Type: application/json');

// --- 1) Connect to DB (same style as submit.php) ---
$host = "localhost";
$user = "root";
$pass = "";  // change if your MySQL has a password
$db   = "construction_solutions";

$mysqli = new mysqli($host, $user, $pass, $db);

if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// --- 2) Only support GET for now ---
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

// --- 3) Read & sanitize ?q= parameter ---
$q = "";
if (isset($_GET['q'])) {
    $q = trim($_GET['q']);
}

// --- 4) Prepare query ---
// If no search text: return all clients (sorted by name)
// If search text: match on name OR email (case-insensitive)
if ($q === "") {
    $sql = "SELECT id, name, email, phone, city, state 
            FROM clients
            ORDER BY name ASC";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(["error" => "Failed to prepare query"]);
        exit;
    }
} else {
    $sql = "SELECT id, name, email, phone, city, state 
            FROM clients
            WHERE LOWER(name)  LIKE ?
               OR LOWER(email) LIKE ?
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

// --- 5) Execute & build results ---
$stmt->execute();
$result = $stmt->get_result();

$clients = [];
while ($row = $result->fetch_assoc()) {
    $clients[] = [
        "id"    => (int)$row["id"],
        "name"  => $row["name"],
        "email" => $row["email"],
        "phone" => $row["phone"],
        "city"  => $row["city"],
        "state" => $row["state"],
    ];
}

$stmt->close();
$mysqli->close();

// --- 6) Return consistent JSON wrapper ---
echo json_encode([
    "results" => $clients
]);
