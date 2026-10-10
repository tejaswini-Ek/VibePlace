export function getUserProfile(req, res) {
  return res.json(req.user);
}
