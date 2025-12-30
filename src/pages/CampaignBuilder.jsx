import { useState, useEffect } from 'react';
import { RiRocketLine, RiRadarLine, RiPieChartLine, RiSettings4Line, RiUserSmileLine, RiImageLine } from 'react-icons/ri';
import { auth, db } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config';

function ContentLibrary({ isLoading, loadingError, activeTab, contentLibrary, selectedContent, setSelectedContent }) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="loading loading-spinner loading-lg text-primary"></div>
        <p className="mt-4 text-base-content/70">Loading content and predictions...</p>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="alert alert-error">
        <div className="flex-1">
          <label>{loadingError}</label>
        </div>
      </div>
    );
  }

  if (!contentLibrary[activeTab]?.length) {
    return (
      <div className="text-center py-8">
        <p className="text-base-content/70">No content found. Create some content in Content Studio first!</p>
      </div>
    );
  }

  return contentLibrary[activeTab].map((item) => (
    <div key={item.id} className="card bg-base-200 mb-3">
      <div className="card-body">
        {activeTab === 'social' ? (
          <>
            <div className="flex justify-between items-center">
              <h5 className="font-medium capitalize">{item.platform} Post</h5>
              {item.prediction && (
                <div className={`badge ${
                  item.prediction === 'high' ? 'badge-success' : 
                  item.prediction === 'medium' ? 'badge-warning' : 
                  'badge-error'
                }`}>
                  {item.prediction.toUpperCase()}
                </div>
              )}
            </div>
            {item.imageUrl && (
              <img 
                src={item.imageUrl} 
                alt="Post image" 
                className="w-full aspect-square object-cover rounded-lg mb-3"
              />
            )}
            <p className="text-sm">{item.content}</p>
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-gray-500">
                Created: {new Date(item.createdAt).toLocaleDateString()}
              </div>
              {item.confidence && (
                <div className="text-xs text-gray-500">
                  {Math.round(item.confidence)}% confidence
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'email' ? (
          <>
            <h5 className="font-medium">{item.subject}</h5>
            <div className="text-sm" dangerouslySetInnerHTML={{ __html: item.content }} />
          </>
        ) : activeTab === 'video' ? (
          <>
            <h5 className="font-medium">{item.title}</h5>
            <p className="text-sm">{item.script}</p>
          </>
        ) : (
          <>
            <h5 className="font-medium capitalize">{item.platform} Ad</h5>
            <p className="text-sm">{item.content}</p>
          </>
        )}
        <div className="card-actions justify-end mt-4">
          <button 
            className={`btn btn-sm ${selectedContent[activeTab]?.includes(item.id) ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedContent(prev => ({
              ...prev,
              [activeTab]: prev[activeTab]?.includes(item.id)
                ? prev[activeTab].filter(id => id !== item.id)
                : [...(prev[activeTab] || []), item.id]
            }))}
          >
            {selectedContent[activeTab]?.includes(item.id) ? 'Selected' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  ));
}

function CampaignSchedule({ selectedContent, contentLibrary }) {
  const scheduleItems = [];
  
  Object.entries(selectedContent).forEach(([type, ids]) => {
    ids.forEach(id => {
      const item = contentLibrary[type]?.find(i => i.id === id);
      if (!item) return;
      
      scheduleItems.push(
        <div key={`${type}-${id}`} className="card bg-base-200">
          <div className="card-body">
            <div className="flex justify-between items-center">
              <h4 className="font-medium capitalize">
                {type === 'email' ? item.subject : 
                 type === 'video' ? item.title :
                 `${item.platform} Post`}
              </h4>
              <input
                type="datetime-local"
                className="input input-bordered input-sm"
              />
            </div>
          </div>
        </div>
      );
    });
  });

  return (
    <div>
      <h3 className="font-semibold mb-4">Campaign Schedule</h3>
      <div className="space-y-4">
        {scheduleItems.length > 0 ? scheduleItems : (
          <div className="text-center py-8">
            <p className="text-base-content/70">No content selected for scheduling</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CampaignBuilder() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedPlatforms, setSelectedPlatforms] = useState(['facebook', 'instagram']);
  const [selectedAudience, setSelectedAudience] = useState(null);
  const [budget, setBudget] = useState(10000);
  const [selectedContent, setSelectedContent] = useState({});
  const [activeTab, setActiveTab] = useState('social');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState(null);
  const [contentLibrary, setContentLibrary] = useState({
    social: [],
    email: [],
    video: [],
    ad: []
  });
  const [activeMode, setActiveMode] = useState('select'); // 'select' | 'automation'

  // Local automation state and handlers (stubs for now)
  const [automationTopic, setAutomationTopic] = useState('');
  const [automationFrequency, setAutomationFrequency] = useState('daily');
  const [automationTime, setAutomationTime] = useState('09:00');
  const [automationTimezone, setAutomationTimezone] = useState('America/Los_Angeles');
  const [automationDays, setAutomationDays] = useState([]);
  const [automationCron, setAutomationCron] = useState('');
  const [automationTone, setAutomationTone] = useState('mixed');
  const [automationMaxHashtags, setAutomationMaxHashtags] = useState(1);
  const [automationNoLinks, setAutomationNoLinks] = useState(true);
  const [automationEnabled, setAutomationEnabled] = useState(false);
  const [automationStatus, setAutomationStatus] = useState(null);
  const [automationInstructions, setAutomationInstructions] = useState('');

  // Builder session id for linking draft -> campaign at launch
  const [builderSessionId] = useState(() => {
    const gen = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    return gen();
  });

  useEffect(() => {
    const fetchSavedContent = async () => {
      try {
        setIsLoading(true);
        setLoadingError(null);
        
        const user = auth.currentUser;
        if (!user) {
          setIsLoading(false);
          return;
        }

        console.log('Fetching content from Firebase...');
        const contentQuery = query(
          collection(db, 'content'),
          where('userId', '==', user.uid)
        );

        const querySnapshot = await getDocs(contentQuery);
        const savedContent = {
          social: [],
          email: [],
          video: [],
          ad: []
        };
        
        // Collect all social media posts first
        const socialPosts = [];
        querySnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (data.type === 'social') {
            socialPosts.push({
              id: data.id,
              platform: data.platform,
              content: data.content,
              imageUrl: data.imageUrl, // Always use base64 for display
              localImagePath: data.localImagePath, // Keep local path for Twitter
              createdAt: data.createdAt,
              eventTitle: data.eventTitle
            });
          } else if (data.type === 'video') {
            savedContent.video.push({
              id: data.id,
              title: data.title,
              script: data.script,
              thumbnail: data.thumbnail,
              createdAt: data.createdAt,
              eventTitle: data.eventTitle
            });
          }
          // Keep existing email and ad cases
        });

        console.log(`Found ${socialPosts.length} social posts, getting predictions...`);

        // Get predictions for all social posts in a single batch request
        if (socialPosts.length > 0) {
          console.log('Getting predictions for all posts...');
          let predictions = socialPosts.map(post => ({
            ...post,
            prediction: 'medium',
            confidence: 50
          }));

          try {
            const response = await fetch('http://localhost:5007/ml/predict_batch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                posts: socialPosts.map(post => ({
                  id: post.id,
                  content: post.content,
                  has_image: !!post.imageUrl,
                  scheduled_time: null
                }))
              }),
            });

            if (response.ok) {
              const { predictions: predictionResults } = await response.json();
              // Map predictions back to posts
              const predictionsMap = new Map(predictionResults.map(p => [p.id, p]));
              predictions = socialPosts.map(post => {
                const prediction = predictionsMap.get(post.id) || { prediction: 'medium', confidence: 50 };
                return {
                  ...post,
                  prediction: prediction.prediction,
                  confidence: prediction.confidence
                };
              });
            } else {
              console.warn('Batch prediction request failed:', await response.text());
            }
          } catch (error) {
            console.error('Error getting batch predictions:', error);
          }

          savedContent.social = predictions.map(post => ({
            id: post.id,
            platform: post.platform,
            content: post.content,
            imageUrl: post.imageUrl,
            localImagePath: post.localImagePath, // Include localImagePath
            createdAt: post.createdAt,
            eventTitle: post.eventTitle,
            prediction: post.prediction,
            confidence: post.confidence
          }));
        }

        console.log('Setting content library...');
        setContentLibrary(prev => ({
          ...prev,
          ...savedContent
        }));
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching content:', error);
        setLoadingError(error.message);
        setIsLoading(false);
      }
    };

    fetchSavedContent();
  }, []);

  const steps = [
    { id: 1, name: 'Campaign Details', icon: RiRocketLine },
    { id: 2, name: 'Audience Targeting', icon: RiRadarLine },
    { id: 3, name: 'Content Selection', icon: RiPieChartLine },
    { id: 4, name: 'Settings & Launch', icon: RiSettings4Line },
  ];

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: '📱' },
    { id: 'instagram', name: 'Instagram', icon: '📸' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
    { id: 'twitter', name: 'Twitter', icon: '🐦' },
  ];

  const audiences = [
    {
      id: 'young-prof',
      name: 'Young Professionals',
      size: '1.2M',
      engagement: '4.8%',
      interests: ['Technology', 'Career Growth', 'Fitness'],
    },
    {
      id: 'parents',
      name: 'Parents',
      size: '850K',
      engagement: '3.2%',
      interests: ['Family', 'Education', 'Health'],
    },
    {
      id: 'business',
      name: 'Business Decision Makers',
      size: '450K',
      engagement: '5.1%',
      interests: ['Business', 'Innovation', 'Leadership'],
    },
  ];

  const [campaignData, setCampaignData] = useState({
    name: '',
    objective: 'Brand Awareness',
    startDate: '',
    endDate: '',
    description: '',
    loading: false,
    error: null
  });

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLaunchCampaign = async () => {
    try {
      setCampaignData(prev => ({ ...prev, loading: true, error: null }));
      
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to launch a campaign');
      }

      // Create campaign object
      const campaign = {
        userId: user.uid,
        name: campaignData.name,
        objective: campaignData.objective,
        startDate: campaignData.startDate,
        endDate: campaignData.endDate,
        description: campaignData.description,
        platforms: selectedPlatforms,
        audience: selectedAudience,
        budget,
        content: selectedContent,
        status: 'active',
        createdAt: new Date().toISOString(),
        metrics: {
          reach: '0',
          engagement: '0%',
          conversions: '0%',
          roi: '0%'
        },
        // Link this builder session for transparency
        builderSessionId
      };

      // Save to Firebase
      const campaignRef = await addDoc(collection(db, 'campaigns'), campaign);

      // Attempt to convert draft automation to a live schedule linked to this campaign
      try {
        await fetch('${API_URL}/api/automation/convert-draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            builderSessionId,
            campaignId: campaignRef.id
          })
        });
      } catch (convErr) {
        console.warn('Automation draft conversion failed (non-blocking):', convErr);
      }

      // Post to Twitter if selected
      if (activeMode === 'select' && selectedPlatforms.includes('twitter')) {
        await postToTwitter();
      }

      // Reset form
      setCampaignData({
        name: '',
        objective: 'Brand Awareness',
        startDate: '',
        endDate: '',
        description: '',
        loading: false,
        error: null
      });
      setCurrentStep(1);
      setSelectedPlatforms(['facebook', 'instagram']);
      setSelectedAudience(null);
      setBudget(10000);
      setSelectedContent({});

      // Navigate to dashboard
      navigate('/dashboard');
      
    } catch (error) {
      setCampaignData(prev => ({ ...prev, error: error.message }));
    } finally {
      setCampaignData(prev => ({ ...prev, loading: false }));
    }
  };

  // Function to post content to Twitter
  const postToTwitter = async () => {
    try {
      // Find selected social media content
      const selectedSocialContents = [];
      
      if (selectedContent.social && selectedContent.social.length > 0) {
        selectedContent.social.forEach(id => {
          const content = contentLibrary.social.find(item => item.id === id);
          if (content) {
            selectedSocialContents.push(content);
          }
        });
      }

      if (selectedSocialContents.length === 0) {
        throw new Error('No social content selected for Twitter campaign');
      }

      // For each selected content
      for (const content of selectedSocialContents) {
        // Only proceed if we have both content text and a local image path
        if (content.content && content.localImagePath) {
          // Truncate text to Twitter's 280 character limit
          const tweetText = content.content.length > 280 
            ? content.content.substring(0, 277) + '...' 
            : content.content;
            
          try {
            // Adjust the path to use backend/src/temp_uploads
            const imagePath = content.localImagePath.replace('temp_uploads', '../../backend/src/temp_uploads');
            
            // Post to Twitter using the local image endpoint
            const tweetResponse = await fetch('http://127.0.0.1:5004/api/tweet-with-local-image', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                text: tweetText,
                imagePath: imagePath
              }),
            });

            if (!tweetResponse.ok) {
              const errorData = await tweetResponse.json();
              throw new Error(`Failed to post to Twitter: ${errorData.message}`);
            }

            const successData = await tweetResponse.json();
            console.log('Tweet posted successfully:', successData);
          } catch (error) {
            console.error('Error posting to Twitter:', error);
            throw error;
          }
        } else {
          console.warn('Skipping post - missing content or local image path:', {
            hasContent: !!content.content,
            hasLocalImagePath: !!content.localImagePath,
            path: content.localImagePath
          });
        }
      }
    } catch (error) {
      console.error('Error in Twitter posting process:', error);
      throw new Error(`Twitter posting failed: ${error.message}`);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Campaign Details Form */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">Campaign Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Campaign Name</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Enter campaign name"
                      className="input input-bordered"
                      value={campaignData.name}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        name: e.target.value
                      }))}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Campaign Objective</span>
                    </label>
                    <select 
                      className="select select-bordered"
                      value={campaignData.objective}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        objective: e.target.value
                      }))}
                    >
                      <option>Brand Awareness</option>
                      <option>Lead Generation</option>
                      <option>Sales Conversion</option>
                      <option>Customer Retention</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Start Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={campaignData.startDate}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        startDate: e.target.value
                      }))}
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">End Date</span>
                    </label>
                    <input
                      type="date"
                      className="input input-bordered"
                      value={campaignData.endDate}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        endDate: e.target.value
                      }))}
                    />
                  </div>
                  <div className="form-control md:col-span-2">
                    <label className="label">
                      <span className="label-text">Campaign Description</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered h-24"
                      placeholder="Describe your campaign objectives and goals"
                      value={campaignData.description}
                      onChange={(e) => setCampaignData(prev => ({
                        ...prev,
                        description: e.target.value
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Platform Selection */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">Platform Selection</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {platforms.map((platform) => (
                    <div
                      key={platform.id}
                      className={`card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors
                        ${selectedPlatforms.includes(platform.id) ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        setSelectedPlatforms(prev => 
                          prev.includes(platform.id)
                            ? prev.filter(id => id !== platform.id)
                            : [...prev, platform.id]
                        );
                      }}
                    >
                      <div className="card-body items-center text-center">
                        <span className="text-4xl">{platform.icon}</span>
                        <h3 className="font-medium mt-2">{platform.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Audience Selection */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">
                  <RiUserSmileLine className="text-primary" />
                  Target Audience Selection
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {audiences.map((audience) => (
                    <div
                      key={audience.id}
                      className={`card bg-base-200 cursor-pointer hover:shadow-lg transition-all
                        ${selectedAudience === audience.id ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => setSelectedAudience(audience.id)}
                    >
                      <div className="card-body">
                        <h3 className="card-title text-lg">{audience.name}</h3>
                        <div className="space-y-2">
                          <p className="text-sm">Size: {audience.size}</p>
                          <p className="text-sm">Engagement: {audience.engagement}</p>
                          <div className="flex flex-wrap gap-1">
                            {audience.interests.map((interest) => (
                              <span key={interest} className="badge badge-primary badge-sm">
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Custom Targeting */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">Custom Targeting</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Age Range</span>
                    </label>
                    <div className="join">
                      <input type="number" className="join-item input input-bordered w-20" placeholder="18" />
                      <span className="join-item btn btn-disabled">to</span>
                      <input type="number" className="join-item input input-bordered w-20" placeholder="65" />
                    </div>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Location</span>
                    </label>
                    <input type="text" className="input input-bordered" placeholder="Enter locations" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Content Selection */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">
                  <RiImageLine className="text-primary" />
                  Content Selection
                </h2>

                {/* Mode Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 mb-6">
                  <div
                    className={`card cursor-pointer ${activeMode === 'select' ? 'ring-2 ring-primary' : 'bg-base-200 hover:bg-base-300'}`}
                    onClick={() => setActiveMode('select')}
                  >
                    <div className="card-body">
                      <h3 className="card-title">Select Content</h3>
                      <p className="text-sm text-base-content/70">Pick from your generated posts and preview the schedule.</p>
                    </div>
                  </div>
                  <div
                    className={`card cursor-pointer ${activeMode === 'automation' ? 'ring-2 ring-primary' : 'bg-base-200 hover:bg-base-300'}`}
                    onClick={() => setActiveMode('automation')}
                  >
                    <div className="card-body">
                      <h3 className="card-title">Automation (Topic-based)</h3>
                      <p className="text-sm text-base-content/70">Post 1 tweet daily/weekly from a general topic with custom timing.</p>
                </div>
                  </div>
                </div>

                {activeMode === 'select' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Content Library */}
                  <div>
                    <h3 className="font-semibold mb-4">Content Library</h3>
                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                      <ContentLibrary 
                        isLoading={isLoading}
                        loadingError={loadingError}
                        activeTab={activeTab}
                        contentLibrary={contentLibrary}
                        selectedContent={selectedContent}
                        setSelectedContent={setSelectedContent}
                      />
                    </div>
                  </div>

                  {/* Campaign Schedule */}
                  <CampaignSchedule 
                    selectedContent={selectedContent}
                    contentLibrary={contentLibrary}
                  />
                </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Automation Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Topic</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="e.g., AI/tech/dev humor"
                          value={automationTopic || ''}
                          onChange={(e) => setAutomationTopic(e.target.value)}
                        />
              </div>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Frequency</span>
                        </label>
                        <select
                          className="select select-bordered"
                          value={automationFrequency}
                          onChange={(e) => setAutomationFrequency(e.target.value)}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="custom">Custom (cron)</option>
                        </select>
                      </div>
                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Instructions (optional)</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered h-24"
                          placeholder="Describe the kind of posts you want (tone, audience, style, etc.)"
                          value={automationInstructions}
                          onChange={(e) => setAutomationInstructions(e.target.value)}
                        />
                      </div>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Time</span>
                        </label>
                        <input
                          type="time"
                          className="input input-bordered"
                          value={automationTime}
                          onChange={(e) => setAutomationTime(e.target.value)}
                        />
                      </div>
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Timezone</span>
                        </label>
                        <input
                          type="text"
                          className="input input-bordered"
                          placeholder="e.g., America/Los_Angeles"
                          value={automationTimezone}
                          onChange={(e) => setAutomationTimezone(e.target.value)}
                        />
                      </div>

                      {automationFrequency === 'weekly' && (
                        <div className="form-control md:col-span-2">
                          <label className="label">
                            <span className="label-text">Days of Week</span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
                              <label key={d} className="label cursor-pointer gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-sm"
                                  checked={automationDays.includes(d)}
                                  onChange={() => toggleAutomationDay(d)}
                                />
                                <span className="label-text">{d}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {automationFrequency === 'custom' && (
                        <div className="form-control md:col-span-2">
                          <label className="label">
                            <span className="label-text">Cron Expression</span>
                          </label>
                          <input
                            type="text"
                            className="input input-bordered"
                            placeholder="e.g., 0 9 * * *"
                            value={automationCron}
                            onChange={(e) => setAutomationCron(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Style</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <select
                            className="select select-bordered"
                            value={automationTone}
                            onChange={(e) => setAutomationTone(e.target.value)}
                          >
                            <option value="humor">Humor</option>
                            <option value="insight">Insight</option>
                            <option value="mixed">Mixed</option>
                          </select>
                          <select
                            className="select select-bordered"
                            value={automationMaxHashtags}
                            onChange={(e) => setAutomationMaxHashtags(Number(e.target.value))}
                          >
                            <option value={0}>0 hashtags</option>
                            <option value={1}>1 hashtag</option>
                            <option value={2}>2 hashtags</option>
                          </select>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={automationNoLinks}
                              onChange={(e) => setAutomationNoLinks(e.target.checked)}
                            />
                            <span className="text-sm">No links</span>
                          </div>
                        </div>
                      </div>

                      <div className="form-control md:col-span-2">
                        <label className="label">
                          <span className="label-text">Enable Automation</span>
                        </label>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={automationEnabled}
                          onChange={(e) => setAutomationEnabled(e.target.checked)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button className="btn btn-primary" onClick={handleSaveAutomation}>Save Schedule</button>
                    </div>

                    {automationStatus && (
                      <div className="mt-4 alert">
                        <div>
                          <h4 className="font-semibold">Status</h4>
                          <p className="text-sm text-base-content/70">Next run: {automationStatus.nextRun || '—'}</p>
                          <p className="text-sm text-base-content/70">Last run: {automationStatus.lastRun || '—'}</p>
                          <p className="text-sm text-base-content/70">Last result: {automationStatus.lastResult || '—'}</p>
                          {automationStatus.lastText && (
                            <p className="text-sm mt-1">Last text: {automationStatus.lastText}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Budget Optimizer */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">AI Budget Optimizer</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Total Campaign Budget</span>
                      </label>
                      <div className="join">
                        <span className="join-item btn btn-neutral">$</span>
                        <input
                          type="number"
                          value={budget}
                          onChange={(e) => setBudget(Number(e.target.value))}
                          className="join-item input input-bordered w-full"
                        />
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <h3 className="font-semibold mb-3">AI-Optimized Allocation</h3>
                      <div className="space-y-4">
                        {selectedPlatforms.map((platform, index) => {
                          const allocation = index === 0 ? 0.6 : 0.4;
                          return (
                            <div key={platform} className="flex items-center gap-4">
                              <span className="text-2xl">
                                {platforms.find(p => p.id === platform)?.icon}
                              </span>
                              <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                  <span className="text-sm font-medium">
                                    {platform.charAt(0).toUpperCase() + platform.slice(1)}
                                  </span>
                                  <span className="text-sm text-primary">
                                    ${(budget * allocation).toLocaleString()}
                                  </span>
                                </div>
                                <div className="w-full bg-base-200 rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full" 
                                    style={{ width: `${allocation * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="alert">
                      <div>
                        <h3 className="font-bold">Budget Optimization Insights</h3>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>60% allocation to Instagram based on audience engagement patterns</li>
                          <li>Recommended daily spend: ${(budget / 30).toFixed(2)} for optimal reach</li>
                          <li>Expected ROI: 287% based on historical data</li>
                        </ul>
                      </div>
                    </div>

                    <div className="card bg-base-200">
                      <div className="card-body">
                        <h3 className="card-title text-lg">Performance Forecast</h3>
                        <div className="stats stats-vertical shadow">
                          <div className="stat">
                            <div className="stat-title">Estimated Reach</div>
                            <div className="stat-value">2.4M</div>
                            <div className="stat-desc">↗︎ 15% vs. last campaign</div>
                          </div>
                          
                          <div className="stat">
                            <div className="stat-title">Projected Conversions</div>
                            <div className="stat-value">3.2%</div>
                            <div className="stat-desc">↗︎ 0.8% vs. benchmark</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Launch Checklist */}
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body">
                <h2 className="card-title">Launch Checklist</h2>
                <ul className="steps steps-vertical">
                  <li className="step step-primary">Campaign details completed</li>
                  <li className="step step-primary">Target audience selected</li>
                  <li className="step step-primary">Content prepared</li>
                  <li className="step step-primary">Budget allocated</li>
                  <li className="step">Ready to launch</li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const toggleAutomationDay = (day) => {
    setAutomationDays((prev) => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  const handleSaveAutomation = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setAutomationStatus({ lastResult: 'Please sign in to save a schedule.' });
        return;
      }

      const [hour, minute] = (automationTime || '09:00').split(':').map((v) => parseInt(v, 10));
      const draftId = `${user.uid}_${builderSessionId}`;
      const payload = {
        userId: user.uid,
        builderSessionId,
        topic: automationTopic || '',
        instructions: automationInstructions || '',
        recurrenceType: automationFrequency,
        hour: isNaN(hour) ? 9 : hour,
        minute: isNaN(minute) ? 0 : minute,
        timezone: automationTimezone || 'UTC',
        daysOfWeek: automationDays,
        cronExpression: automationCron || null,
        style: {
          tone: automationTone,
          maxHashtags: automationMaxHashtags,
          noLinks: !!automationNoLinks
        },
        isEnabled: !!automationEnabled,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'draft_schedules', draftId), payload, { merge: true });

      setAutomationStatus({
        nextRun: '—',
        lastRun: '—',
        lastResult: 'Draft saved',
        lastText: undefined
      });
    } catch (e) {
      setAutomationStatus({ lastResult: `Save failed: ${e.message || 'unknown error'}` });
    }
  };
  const handleRunAutomationNow = () => {
    // TODO: Wire to backend later
    setAutomationStatus((prev) => ({
      ...(prev || {}),
      lastRun: new Date().toLocaleString(),
      lastResult: 'Triggered (stub)',
      lastText: 'Example generated tweet preview...'
    }));
  };
  const handleViewAutomationHistory = () => {
    // TODO: Wire to backend later
    alert('Automation history will appear here (stub)');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Campaign Builder</h1>
        <div className="flex gap-2">
          <button 
            className="btn btn-outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            Back
          </button>
          {currentStep < steps.length ? (
            <button 
              className="btn btn-primary"
              onClick={handleNext}
              disabled={
                (currentStep === 1 && (!campaignData.name || !campaignData.objective)) ||
                (currentStep === 2 && !selectedAudience)
              }
            >
              Next Step
            </button>
          ) : (
            <button 
              className={`btn btn-success ${campaignData.loading ? 'loading' : ''}`}
              onClick={handleLaunchCampaign}
              disabled={campaignData.loading}
            >
              Launch Campaign
            </button>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex justify-between">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center ${
              step.id < steps.length ? 'flex-1' : ''
            }`}
          >
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 
                ${
                  step.id === currentStep
                    ? 'border-primary bg-primary text-primary-content'
                    : step.id < currentStep
                    ? 'border-success bg-success text-success-content'
                    : 'border-base-300'
                }`}
            >
              <step.icon className="w-5 h-5" />
            </div>
            <div
              className={`flex-1 h-0.5 ${
                step.id < steps.length
                  ? step.id < currentStep
                    ? 'bg-success'
                    : 'bg-base-300'
                  : 'hidden'
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step Content */}
      {renderStepContent()}

      {/* Error Message */}
      {campaignData.error && (
        <div className="alert alert-error">
          <div className="flex-1">
            <label>{campaignData.error}</label>
          </div>
        </div>
      )}
    </div>
  );
} 