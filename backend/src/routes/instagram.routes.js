const express = require("express");
const { fetchInstagramProfile } = require("../services/instagram.service");

const router = express.Router();

router.get("/instagram", async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    const data = await fetchInstagramProfile(username);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Instagram data" });
  }
});

module.exports = router;
