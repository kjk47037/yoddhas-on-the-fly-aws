const fetch = require("node-fetch");

async function fetchInstagramProfile(username) {
  const APIFY_TOKEN = process.env.APIFY_TOKEN;

  const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      usernames: [username],
      resultsType: "posts",
      resultsLimit: 15,
      addParentData: true
    })
  });

  const data = await response.json();

  if (!data || !data.length) {
    throw new Error("No data returned from Apify");
  }

  const profile = data[0]?.owner || {};

  const posts = data.map(post => ({
    id: post.id,
    like_count: post.likesCount,
    comment_count: post.commentsCount,
    taken_at: new Date(post.timestamp).getTime() / 1000,
    image_url: post.displayUrl,
    caption: post.caption,
    media_type: post.type === "Video" ? 2 : 1
  }));

  return {
    profile: {
      username: profile.username,
      follower_count: profile.followersCount,
      following_count: profile.followsCount,
      biography: profile.biography,
      profile_pic_url: profile.profilePicUrl
    },
    posts
  };
}

module.exports = { fetchInstagramProfile };
