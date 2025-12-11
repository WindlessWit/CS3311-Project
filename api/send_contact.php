<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// PHPMailer is in the project root, so go up one level from /api
require __DIR__ . '/../PHPMailer/src/Exception.php';
require __DIR__ . '/../PHPMailer/src/PHPMailer.php';
require __DIR__ . '/../PHPMailer/src/SMTP.php';

$mail = new PHPMailer(true);

try {
    // Gmail SMTP settings
    $mail->isSMTP();
    $mail->Host = 'smtp.gmail.com';
    $mail->SMTPAuth = true;
    $mail->Username = 'zerricstewart@gmail.com';
    $mail->Password = 'gbok onwj xriy uqol';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = 587;

    // Sender (must match your Gmail)
    $mail->setFrom('zerricstewart@gmail.com', 'Construction Solutions Contact Form');

    // Recipient (where you want to receive the message)
    $mail->addAddress('zerricstewart@isu.edu');

    // Get form fields
    $name = $_POST['name'] ?? '';
    $email = $_POST['email'] ?? '';
    $phone = $_POST['phone'] ?? '';
    $message = $_POST['message'] ?? '';

    // Email content
    $mail->isHTML(true);
    $mail->Subject = "New Contact Form Message from $name";
    $mail->Body = "
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
        <p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
        <p><strong>Phone:</strong> " . htmlspecialchars($phone) . "</p>
        <p><strong>Message:</strong><br>" . nl2br(htmlspecialchars($message)) . "</p>
    ";

    // Replies go to the visitor
    if ($email) {
        $mail->addReplyTo($email, $name);
    }

    $mail->send();
    echo "OK";

} catch (Exception $e) {
    echo "Mailer Error: {$mail->ErrorInfo}";
}
