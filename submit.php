<?php
// Connect to MySQL
$conn = new mysqli("localhost", "root", "", "company_site");

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Sanitize form input
$name = $conn->real_escape_string($_POST['name']);
$email = $conn->real_escape_string($_POST['email']);
$phone = $conn->real_escape_string($_POST['phone']);
$service = $conn->real_escape_string($_POST['service']);
$details = $conn->real_escape_string($_POST['details']);

// Insert into database
$sql = "INSERT INTO quote_requests (name, email, phone, service, details)
VALUES ('$name', '$email', '$phone', '$service', '$details')";

if ($conn->query($sql) === TRUE) {
    echo "Thank you! Your request has been submitted.";
} else {
    echo "Error: " . $conn->error;
}

$conn->close();
