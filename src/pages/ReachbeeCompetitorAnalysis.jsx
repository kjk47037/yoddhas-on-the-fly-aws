import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const ReachbeeCompetitorAnalysis = () => {
  const [industry, setIndustry] = useState("");
  const [competitorList, setCompetitorList] = useState([]);
  const [username, setUsername] = useState("");
  const [profileData, setProfileData] = useState(null);
  const [postData, setPostData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState(null);

  useEffect(() => {
    const storedIndustry = localStorage.getItem('userIndustry');
    if (storedIndustry) {
      setIndustry(storedIndustry);
      fetchCompetitors(storedIndustry);
    }
  }, []);

  const fetchCompetitors = async (industryName) => {
    try {
      const response = await fetch(`http://127.0.0.1:5004/api/instagram/competitors/${encodeURIComponent(industryName)}`);
      if (response.ok) {
        const data = await response.json();
        setCompetitorList(data.competitors || []);
      }
    } catch (err) {
      console.error("Error fetching competitors:", err);
      // Fallback to default competitors if API fails
      const competitorsByIndustry = {
        Technology: ["techcrunch", "verge", "wired", "engadget", "mashable"],
        Retail: ["walmart", "target", "bestbuy", "costco", "amazon"],
        Healthcare: ["mayoclinic", "clevelandclinic", "webmd", "healthline", "johnshopkinshospital"],
        Finance: ["forbes", "bloomberg", "wsj", "ft", "investopedia"],
        Education: ["harvard", "mit", "edxonline", "coursera", "udemy"],
        Manufacturing: ["generalelectric", "boschglobal", "abbgroupnews", "honeywell", "siemens"]
      };
      setCompetitorList(competitorsByIndustry[industryName] || ["nike", "starbucks", "google", "netflix", "adobe"]);
    }
  };

  const handleCompetitorClick = (competitorUsername) => {
    setUsername(competitorUsername);
    fetchProfileDataWithUser(competitorUsername);
  };

  const fetchProfileDataWithUser = async (uname) => {
    if (!uname.trim()) {
      setError("Please enter a username.");
      return;
    }
    setError("");
    setLoading(true);
    setProfileData(null);
    setPostData(null);

    try {
      // Fetch profile data from backend
      const profileRes = await fetch(`http://127.0.0.1:5004/api/instagram/profile/${uname}`);
      
      if (!profileRes.ok) {
        throw new Error('Failed to fetch profile data');
      }
      
      const profileResult = await profileRes.json();
      
      if (profileResult.error) {
        throw new Error(profileResult.error);
      }
      
      setProfileData(profileResult.profile);

      // Fetch posts data from backend
      const postsRes = await fetch(`http://127.0.0.1:5004/api/instagram/posts/${uname}`);
      
      if (!postsRes.ok) {
        throw new Error('Failed to fetch posts data');
      }
      
      const postsResult = await postsRes.json();
      
      if (postsResult.error) {
        throw new Error(postsResult.error);
      }
      
      // Limit to top 15 posts
      const limitedPosts = {
        items: postsResult.posts ? postsResult.posts.slice(0, 15) : []
      };
      setPostData(limitedPosts);
      
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "Failed to fetch data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProfileData = async () => {
    fetchProfileDataWithUser(username);
  };

  const analyzeTopPosts = async () => {
    if (!postData?.items) {
      setError("Please ensure posts are loaded before generating AI insights.");
      return;
    }

    setShowAnalysisModal(true);
    setAnalysisLoading(true);
    setAiInsights(null);

    try {
      // Get top 5 posts by engagement
      const topPosts = postData.items
        .map(post => ({
          ...post,
          totalEngagement: (post.like_count || 0) + (post.comment_count || 0)
        }))
        .sort((a, b) => b.totalEngagement - a.totalEngagement)
        .slice(0, 5);

      // Prepare data for analysis
      const analysisData = {
        profile: {
          username: profileData.username,
          followers: profileData.follower_count,
          category: profileData.category,
          bio: profileData.biography
        },
        topPosts: topPosts.map(post => ({
          likes: post.like_count || 0,
          comments: post.comment_count || 0,
          caption: post.caption?.text || "",
          mediaType: post.media_type === 1 ? 'Photo' : post.media_type === 2 ? 'Video' : 'Carousel',
          hashtags: post.caption?.text?.match(/#\w+/g) || [],
          postDate: new Date(post.taken_at * 1000).toLocaleDateString()
        }))
      };

      const prompt = `
        Analyze this Instagram competitor's top-performing posts and provide actionable insights:

        Profile: @${analysisData.profile.username}
        Followers: ${analysisData.profile.followers?.toLocaleString()}
        Category: ${analysisData.profile.category || 'Unknown'}
        Bio: ${analysisData.profile.bio || 'No bio'}

        Top 5 Posts by Engagement:
        ${analysisData.topPosts.map((post, i) => `
        Post ${i + 1}:
        - Type: ${post.mediaType}
        - Likes: ${post.likes?.toLocaleString()}
        - Comments: ${post.comments?.toLocaleString()}
        - Caption: ${post.caption?.substring(0, 200)}${post.caption?.length > 200 ? '...' : ''}
        - Hashtags: ${post.hashtags?.join(', ') || 'None'}
        - Date: ${post.postDate}
        `).join('\n')}

        Please provide:
        1. Content Strategy Analysis - What content types and themes perform best?
        2. Engagement Patterns - What drives likes and comments?
        3. Timing Insights - When do they post for maximum engagement?
        4. Caption & Hashtag Strategy - How do they write captions and use hashtags?
        5. Actionable Recommendations - 5 specific tactics to implement for better visibility and engagement

        Format your response in clear sections with specific, actionable advice.
      `;

      // Use environment variable for API key
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!geminiApiKey) {
        throw new Error("API key not configured. Please set REACT_APP_GEMINI_API_KEY in your environment variables.");
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const analysisText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (analysisText) {
        setAiInsights(analysisText);
      } else {
        throw new Error("No analysis generated");
      }

    } catch (err) {
      console.error("AI Analysis error:", err);
      setError("Failed to generate AI insights. Please check your API configuration and try again.");
    }
    
    setAnalysisLoading(false);
  };

  // Data processing for charts
  const getEngagementData = () => {
    if (!postData?.items) return [];
    
    return postData.items.map((post, index) => ({
      post: `Post ${index + 1}`,
      likes: post.like_count || 0,
      comments: post.comment_count || 0,
      plays: post.play_count || 0
    }));
  };

  const getMediaTypeData = () => {
    if (!postData?.items) return [];
    
    const mediaTypes = postData.items.reduce((acc, post) => {
      const type = post.media_type === 1 ? 'Photo' : post.media_type === 2 ? 'Video' : 'Carousel';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(mediaTypes).map(([type, count]) => ({
      name: type,
      value: count
    }));
  };

  const getPostingFrequency = () => {
    if (!postData?.items) return [];
    
    const dateGroups = postData.items.reduce((acc, post) => {
      const date = new Date(post.taken_at * 1000).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(dateGroups)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([date, count]) => ({
        date,
        posts: count
      }));
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header Section */}
        <div className="flex flex-col space-y-2">
          <h1 className="text-2xl font-bold text-base-content">Competitor Analysis</h1>
          <p className="text-base text-base-content">
            Analyze Instagram profiles and get insights into competitor performance
          </p>
        </div>

        {/* Competitor Suggestions Section */}
        {industry && competitorList.length > 0 && !profileData && (
          <div className="max-w-2xl mx-auto mb-8">
            <div className="bg-base-100 shadow-xl rounded-3xl p-8 mb-4">
              <h3 className="text-lg font-bold mb-3">Top {industry} Competitors</h3>
              <div className="flex flex-wrap gap-3">
                {competitorList.map((competitor) => (
                  <button
                    key={competitor}
                    className="btn btn-outline btn-secondary rounded-xl text-base"
                    onClick={() => handleCompetitorClick(competitor)}
                  >
                    @{competitor}
                  </button>
                ))}
              </div>
              <p className="text-sm text-base-content/60 mt-2 mb-0">Pick a competitor to analyze, or enter any username below.</p>
            </div>
          </div>
        )}
        {/* Search Section */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="card bg-base-100 shadow-xl rounded-3xl">
            <div className="card-body p-8">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Enter Instagram username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input input-bordered input-lg flex-1 rounded-2xl text-lg"
                />
                <button
                  onClick={fetchProfileData}
                  className="btn btn-primary btn-lg rounded-2xl px-8"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading loading-spinner loading-md"></span>
                  ) : (
                    "Analyze"
                  )}
                </button>
              </div>
              
              {loading && (
                <div className="mt-6 text-center">
                  <p className="text-blue-600 text-lg font-medium">
                    Fetching profile and posts data...
                  </p>
                </div>
              )}
              
              {error && (
                <div className="alert alert-error mt-6 rounded-2xl">
                  <span className="text-lg">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Button */}
        {postData && postData.items && (
          <div className="max-w-2xl mx-auto mb-8">
            <button
              onClick={analyzeTopPosts}
              className="btn btn-secondary btn-lg w-full rounded-2xl text-lg font-bold"
            >
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate AI Insights
            </button>
          </div>
        )}

        {/* Profile Overview */}
        {profileData && (
          <div className="card bg-base-100 shadow-xl rounded-3xl mb-8">
            <div className="card-body p-8">
              <h2 className="text-xl font-bold mb-6 text-base-content">Profile Overview</h2>
              <div className="flex flex-col lg:flex-row items-start gap-8">
                <div className="flex-shrink-0">
                  <div className="avatar">
                    <div className="w-32 h-32 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                      <img
                        src={profileData.hd_profile_pic_url_info?.url || profileData.profile_pic_url}
                        alt="Profile"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">USERNAME</p>
                      <p className="text-xl font-bold text-base-content">@{profileData.username}</p>
                    </div>
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">FOLLOWERS</p>
                      <p className="text-xl font-bold text-base-content">{profileData.follower_count?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">FOLLOWING</p>
                      <p className="text-xl font-bold text-base-content">{profileData.following_count?.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">TOTAL POSTS</p>
                      <p className="text-xl font-bold text-base-content">{profileData.media_count?.toLocaleString()}</p>
                    </div>
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">CATEGORY</p>
                      <p className="text-xl font-bold text-base-content">{profileData.category || 'N/A'}</p>
                    </div>
                    <div className="p-4 bg-base-100 rounded-2xl">
                      <p className="text-sm text-base-content font-medium">EMAIL</p>
                      <p className="text-xl font-bold text-base-content">{profileData.public_email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {profileData.biography && (
                <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl">
                  <p className="text-sm text-base-content font-medium mb-2">BIO</p>
                  <p className="text-lg text-base-content leading-relaxed">{profileData.biography}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Section */}
        {postData && postData.items && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="card bg-base-100 shadow-xl rounded-3xl">
              <div className="card-body p-8">
                <h3 className="text-xl font-bold mb-6 text-base-content">Key Performance Metrics</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="text-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl">
                    <p className="text-3xl font-bold mb-2">
                      {Math.round(postData.items.reduce((sum, post) => sum + (post.like_count || 0), 0) / postData.items.length).toLocaleString()}
                    </p>
                    <p className="text-blue-100 font-medium">Avg Likes/Post</p>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl">
                    <p className="text-3xl font-bold mb-2">
                      {Math.round(postData.items.reduce((sum, post) => sum + (post.comment_count || 0), 0) / postData.items.length).toLocaleString()}
                    </p>
                    <p className="text-green-100 font-medium">Avg Comments/Post</p>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl">
                    <p className="text-3xl font-bold mb-2">
                      {((postData.items.reduce((sum, post) => sum + (post.like_count || 0) + (post.comment_count || 0), 0) / postData.items.length) / (profileData?.follower_count || 1) * 100).toFixed(2)}%
                    </p>
                    <p className="text-purple-100 font-medium">Engagement Rate</p>
                  </div>
                  <div className="text-center p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl">
                    <p className="text-3xl font-bold mb-2">
                      {postData.items.length}
                    </p>
                    <p className="text-orange-100 font-medium">Posts Analyzed</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Engagement Chart */}
            <div className="card bg-base-100 shadow-xl rounded-3xl">
              <div className="card-body p-8">
                <h3 className="text-xl font-bold mb-6 text-base-content">Post Engagement Analysis</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getEngagementData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="post" 
                        tick={{ fontSize: 12 }}
                        stroke="#64748b"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke="#64748b"
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: 'none',
                          borderRadius: '12px',
                          color: 'white'
                        }}
                      />
                      <Bar dataKey="likes" fill="#6366f1" name="Likes" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="comments" fill="#10b981" name="Comments" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="plays" fill="#f59e0b" name="Plays" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Content Distribution & Posting Frequency */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Media Type Distribution */}
              <div className="card bg-base-100 shadow-xl rounded-3xl">
                <div className="card-body p-8">
                  <h3 className="text-xl font-bold mb-6 text-base-content">Content Type Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={getMediaTypeData()}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {getMediaTypeData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Posting Frequency */}
              <div className="card bg-base-100 shadow-xl rounded-3xl">
                <div className="card-body p-8">
                  <h3 className="text-xl font-bold mb-6 text-base-content">Posting Frequency</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getPostingFrequency()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 10 }}
                          stroke="#64748b"
                        />
                        <YAxis 
                          tick={{ fontSize: 12 }}
                          stroke="#64748b"
                        />
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: '#1f2937',
                            border: 'none',
                            borderRadius: '12px',
                            color: 'white'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="posts" 
                          stroke="#6366f1" 
                          strokeWidth={3}
                          dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Posts Grid */}
            <div className="card bg-base-100 shadow-xl rounded-3xl">
              <div className="card-body p-8">
                <h3 className="text-xl font-bold mb-6 text-base-content">Recent Posts Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {postData.items.slice(0, 6).map((post, index) => (
                    <div key={post.id} className="card bg-base-100 shadow-lg rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300">
                      <figure className="aspect-square">
                        <img
                          src={post.image_versions2?.candidates?.[0]?.url || post.thumbnail_url}
                          alt={`Post ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </figure>
                      <div className="card-body p-4">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-bold text-base-content">
                              {(post.like_count || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-bold text-base-content">
                              {(post.comment_count || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-base-content font-medium">
                          {new Date(post.taken_at * 1000).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}


        {/* AI Analysis Modal */}
        {showAnalysisModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">AI Content Analysis</h2>
                    <p className="text-gray-600">Analyzing competitor strategies and generating insights</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAnalysisModal(false)}
                  className="btn btn-ghost btn-circle btn-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {analysisLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-bold text-gray-900">Analyzing Content Strategy</h3>
                      <p className="text-gray-600 max-w-md">
                        Our AI is studying the top-performing posts, identifying patterns, and generating actionable insights for your content strategy.
                      </p>
                    </div>
                    <div className="w-full max-w-md bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
                    </div>
                  </div>
                ) : aiInsights ? (
                  <div className="prose max-w-none">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 m-0">Analysis Complete!</h3>
                          <p className="text-gray-600 text-sm m-0">Here are your personalized insights and recommendations</p>
                        </div>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                      {aiInsights}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-red-500 mb-4">
                      <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Analysis Failed</h3>
                    <p className="text-gray-600">Unable to generate insights. Please check your API configuration and try again.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReachbeeCompetitorAnalysis;