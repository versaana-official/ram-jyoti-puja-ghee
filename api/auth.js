export default async function handler(req, res) {
  const client_id = process.env.OAUTH_CLIENT_ID;
  const redirect_uri = `https://${req.headers.host}/api/callback`;
  
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${client_id}&scope=repo&redirect_uri=${encodeURIComponent(redirect_uri)}`
  );
}
