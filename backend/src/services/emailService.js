const nodemailer = require('nodemailer');

const smtpConfigured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTP(toEmail, otp, purpose = 'login') {
  const isRegister = purpose === 'register';
  const subject = isRegister
    ? 'Verify your Sales Orbit account'
    : 'Your Sales Orbit sign-in code';

  const html = `
  <div style="font-family:'Google Sans',Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e8eaed">
    <div style="background:linear-gradient(135deg,#4796E3,#9177C7,#CA6673);padding:28px 32px">
      <div style="display:flex;align-items:center;gap:12px">
        <svg width="28" height="28" viewBox="0 0 80 80" fill="none"><path d="M40 4C40 4 41.6 22 47 35C53 49 68 40 76 40C68 40 53 31 47 45C41.6 58 40 76 40 76C40 76 38.4 58 33 45C27 31 12 40 4 40C12 40 27 49 33 35C38.4 22 40 4 40 4Z" fill="#fff"/></svg>
        <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px">Sales Orbit</span>
      </div>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#202124;letter-spacing:-.3px">
        ${isRegister ? 'Verify your email' : 'Your sign-in code'}
      </h2>
      <p style="margin:0 0 24px;font-size:13px;color:#5F6368;line-height:1.6">
        ${isRegister
          ? 'Enter the code below to verify your email and activate your Channel Partner account.'
          : 'Use the code below to complete your sign-in. It expires in 10 minutes.'}
      </p>
      <div style="background:linear-gradient(135deg,rgba(71,150,227,.08),rgba(145,119,199,.08));border:1px solid rgba(145,119,199,.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#202124;font-variant-numeric:tabular-nums">${otp}</div>
        <div style="font-size:11px;color:#9AA0A6;margin-top:8px">Expires in 10 minutes · Do not share this code</div>
      </div>
      <p style="font-size:12px;color:#9AA0A6;margin:0">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f1f3f4;background:#f8f9fa">
      <p style="font-size:11px;color:#9AA0A6;margin:0;text-align:center">Sales Orbit · Channel Partners Platform</p>
    </div>
  </div>`;

  if (!transporter) {
    console.log(`[dev OTP] ${purpose} code for ${toEmail}: ${otp}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject,
    html,
  });
}

module.exports = { generateOTP, sendOTP };
