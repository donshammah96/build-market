import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: "buildmarkettest@gmail.com",
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
  },
});

const sendMail = async ({
  email,
  subject,
  text,
}: {
  email: string;
  subject: string;
  text: string;
}) => {
  const res = await transporter.sendMail({
    from: '"Lama Dev" <lamadev@gmail.com>',
    to: email,
    subject,
    text,
  });

  console.log("MESSAGE SENT:", res);
};

export default sendMail;