<?php
$to = "your_email@example.com";

$name = $_POST["name"] ?? "";
$email = $_POST["email"] ?? "";
$phone = $_POST["phone"] ?? "";
$message = $_POST["message"] ?? "";

$subject = "New Contact Form Message from $name";

$body = "
Name: $name
Email: $email
Phone: $phone

Message:
$message
";

$headers = "From: $email\r\nReply-To: $email\r\n";

if (mail($to, $subject, $body, $headers)) {
    echo "OK";
} else {
    echo "ERROR";
}
?>
