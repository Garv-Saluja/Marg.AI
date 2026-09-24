import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "change_me_dev_secret";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { userId, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function signToken(user) {
  return jwt.sign({ userId: user.user_id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}
