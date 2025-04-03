// File: src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import TherapySession from './components/TherapySession';
import UserProfile from './components/UserProfile';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import { TherapyProvider } from './context/TherapyContext';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState('session'); // 'session', 'profile', 'dashboard'

  const handleLogin = (credentials) => {
    // In a real app, this would authenticate with a backend
    console.log('Login attempted with:', credentials);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : (
        <TherapyProvider>
          <header className="App-header">
            <h1>Therapy Companion</h1>
            <nav>
              <button onClick={() => setActiveView('session')}>Therapy Session</button>
              <button onClick={() => setActiveView('profile')}>My Profile</button>
              <button onClick={() => setActiveView('dashboard')}>Progress Dashboard</button>
              <button onClick={handleLogout}>Logout</button>
            </nav>
          </header>
          <main>
            {activeView === 'session' && <TherapySession />}
            {activeView === 'profile' && <UserProfile />}
            {activeView === 'dashboard' && <Dashboard />}
          </main>
        </TherapyProvider>
      )}
    </div>
  );
}

export default App;

// File: src/context/TherapyContext.js
import React, { createContext, useState, useEffect } from 'react';
import TherapyCompanionAgent from '../services/TherapyCompanionAgent';

export const TherapyContext = createContext();

export const TherapyProvider = ({ children }) => {
  const [userProfile, setUserProfile] = useState({
    id: '12345',
    name: 'Alex',
    therapeuticGoals: ['anxiety-management', 'stress-reduction'],
    currentStressors: ['work', 'relationships'],
    sessionFrequency: 7,
    preferredDuration: '10 min',
    preferredActivityType: 'exercise',
    interventionEffectiveness: {
      'breathing-exercise': 0.8,
      'cognitive-reframing': 0.6
    }
  });
  
  const [sessionHistory, setSessionHistory] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [therapyAgent, setTherapyAgent] = useState(null);
  
  // Initialize therapy agent
  useEffect(() => {
    const agent = new TherapyCompanionAgent(userProfile);
    setTherapyAgent(agent);
  }, [userProfile.id]); // Reinitialize if user changes
  
  const startSession = async () => {
    if (!therapyAgent) return;
    
    const session = await therapyAgent.startSession();
    setCurrentSession(session);
    return session;
  };
  
  const processMessage = async (message) => {
    if (!therapyAgent) return null;
    
    const response = await therapyAgent.processUserInput(message);
    
    // Update session history
    setSessionHistory(prev => [...prev, {
      timestamp: new Date(),
      userInput: message,
      agentResponse: response
    }]);
    
    return response;
  };
  
  const endSession = async () => {
    if (!therapyAgent) return null;
    
    const summary = await therapyAgent.endSession();
    setCurrentSession(null);
    return summary;
  };
  
  const updateProfile = (newProfile) => {
    setUserProfile(prev => ({
      ...prev,
      ...newProfile
    }));
  };
  
  return (
    <TherapyContext.Provider
      value={{
        userProfile,
        updateProfile,
        sessionHistory,
        currentSession,
        startSession,
        processMessage,
        endSession
      }}
    >
      {children}
    </TherapyContext.Provider>
  );
};

// File: src/components/TherapySession.js
import React, { useState, useContext, useEffect, useRef } from 'react';
import { TherapyContext } from '../context/TherapyContext';
import MessageBubble from './MessageBubble';
import SafetyAlert from './SafetyAlert';

const TherapySession = () => {
  const {
    currentSession,
    startSession,
    processMessage,
    endSession
  } = useContext(TherapyContext);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [showSafetyAlert, setShowSafetyAlert] = useState(false);
  const [safetyInfo, setSafetyInfo] = useState(null);
  
  const messagesEndRef = useRef(null);
  
  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const handleStartSession = async () => {
    const session = await startSession();
    setIsSessionActive(true);
    setSessionSummary(null);
    
    // Add initial greeting from agent
    setMessages([{
      id: Date.now(),
      sender: 'agent',
      text: session.greeting,
      timestamp: new Date()
    }]);
  };
  
  const handleSendMessage = async () => {
    if (!inputText.trim() || !isSessionActive) return;
    
    // Add user message
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: inputText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    // Process message with agent
    const response = await processMessage(inputText);
    
    // Check for safety concerns
    if (response.type === 'emergency' || response.type === 'resource') {
      setShowSafetyAlert(true);
      setSafetyInfo(response);
    }
    
    // Add agent response
    setMessages(prev => [...prev, {
      id: Date.now() + 1,
      sender: 'agent',
      text: response.message || response.introduction,
      content: response.content,
      followUp: response.followUp,
      timestamp: new Date()
    }]);
  };
  
  const handleEndSession = async () => {
    const summary = await endSession();
    setIsSessionActive(false);
    setSessionSummary(summary);
  };
  
  const handleCloseSafetyAlert = () => {
    setShowSafetyAlert(false);
  };

  return (
    <div className="therapy-session">
      {showSafetyAlert && (
        <SafetyAlert 
          info={safetyInfo} 
          onClose={handleCloseSafetyAlert} 
        />
      )}
      
      {!isSessionActive && !sessionSummary && (
        <div className="session-start">
          <h2>Ready for your therapy session?</h2>
          <p>Take a moment to prepare yourself for this session. Find a quiet, comfortable space where you won't be disturbed.</p>
          <button onClick={handleStartSession}>Start Session</button>
        </div>
      )}
      
      {isSessionActive && (
        <div className="session-active">
          <div className="messages-container">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="input-area">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Share what's on your mind..."
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            />
            <button onClick={handleSendMessage}>Send</button>
            <button onClick={handleEndSession} className="end-session-btn">
              End Session
            </button>
          </div>
        </div>
      )}
      
      {sessionSummary && (
        <div className="session-summary">
          <h2>Session Summary</h2>
          <div className="summary-content">
            <h3>Main Themes</h3>
            <ul>
              {sessionSummary.summary.mainThemes.map((theme, i) => (
                <li key={i}>{theme}</li>
              ))}
            </ul>
            
            <h3>Key Insights</h3>
            <ul>
              {sessionSummary.summary.keyInsights.map((insight, i) => (
                <li key={i}>{insight}</li>
              ))}
            </ul>
            
            <h3>Emotional Journey</h3>
            <p>Overall trend: {sessionSummary.summary.emotionalJourney.trend}</p>
            
            <h3>Home Activity</h3>
            <div className="home-activity">
              <h4>{sessionSummary.homeActivity.activity.name}</h4>
              <p>{sessionSummary.homeActivity.instructions}</p>
              <p>{sessionSummary.homeActivity.recommendation}</p>
            </div>
            
            <h3>Next Session</h3>
            <p>Recommended date: {new Date(sessionSummary.nextSessionRecommendation.recommendedDate).toLocaleDateString()}</p>
            <p>Suggested focus: {sessionSummary.nextSessionRecommendation.recommendedFocus}</p>
          </div>
          
          <button onClick={handleStartSession}>Start New Session</button>
        </div>
      )}
    </div>
  );
};

export default TherapySession;

// File: src/components/MessageBubble.js
import React from 'react';

const MessageBubble = ({ message }) => {
  const { sender, text, content, followUp, timestamp } = message;
  
  return (
    <div className={`message-bubble ${sender}`}>
      <div className="message-content">
        <p>{text}</p>
        
        {content && (
          <div className="activity-content">
            {content}
          </div>
        )}
        
        {followUp && (
          <div className="follow-up">
            <p>{followUp}</p>
          </div>
        )}
      </div>
      <div className="message-timestamp">
        {new Date(timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default MessageBubble;

// File: src/components/SafetyAlert.js
import React from 'react';

const SafetyAlert = ({ info, onClose }) => {
  return (
    <div className="safety-alert">
      <div className="safety-alert-content">
        <h2>{info.type === 'emergency' ? 'Important Safety Information' : 'Support Resources'}</h2>
        <p>{info.message}</p>
        
        {info.resources && (
          <div className="resources">
            <h3>Resources Available Now:</h3>
            <ul>
              {info.resources.map((resource, i) => (
                <li key={i}>
                  <strong>{resource.name}</strong>: {resource.contact} ({resource.available})
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {info.instructions && <p className="instructions">{info.instructions}</p>}
        {info.continuePrompt && <p>{info.continuePrompt}</p>}
        
        <button onClick={onClose}>Acknowledge</button>
      </div>
    </div>
  );
};

export default SafetyAlert;

// File: src/components/Dashboard.js
import React, { useContext } from 'react';
import { TherapyContext } from '../context/TherapyContext';

const Dashboard = () => {
  const { sessionHistory, userProfile } = useContext(TherapyContext);
  
  // Mock progress data - in a real app, this would be calculated from session history
  const emotionalProgress = [
    { date: '01/10', anxiety: 7, depression: 6, overall: 5 },
    { date: '01/17', anxiety: 6, depression: 6, overall: 5 },
    { date: '01/24', anxiety: 6, depression: 5, overall: 6 },
    { date: '01/31', anxiety: 5, depression: 5, overall: 6 },
    { date: '02/07', anxiety: 4, depression: 4, overall: 7 }
  ];
  
  const activityCompletion = [
    { name: 'Breathing Exercise', completed: 8, goal: 10 },
    { name: 'Thought Journal', completed: 12, goal: 14 },
    { name: 'Meditation', completed: 5, goal: 10 }
  ];
  
  const insights = [
    'You've made consistent progress in reducing anxiety levels',
    'Morning sessions appear to be more effective for you',
    'Breathing exercises show the strongest correlation with mood improvement'
  ];

  return (
    <div className="dashboard">
      <h2>Your Therapy Progress</h2>
      
      <div className="dashboard-section">
        <h3>Emotional Wellbeing Trends</h3>
        <div className="chart-placeholder">
          {/* In a real app, this would be a chart component */}
          <table className="progress-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Anxiety</th>
                <th>Depression</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {emotionalProgress.map((entry, i) => (
                <tr key={i}>
                  <td>{entry.date}</td>
                  <td>{entry.anxiety}</td>
                  <td>{entry.depression}</td>
                  <td>{entry.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="dashboard-section">
        <h3>Activity Completion</h3>
        <div className="activities-list">
          {activityCompletion.map((activity, i) => (
            <div key={i} className="activity-progress">
              <h4>{activity.name}</h4>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${(activity.completed / activity.goal) * 100}%` }}
                ></div>
              </div>
              <p>{activity.completed}/{activity.goal} completed</p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="dashboard-section">
        <h3>Insights</h3>
        <ul className="insights-list">
          {insights.map((insight, i) => (
            <li key={i}>{insight}</li>
          ))}
        </ul>
      </div>
      
      <div className="dashboard-section">
        <h3>Session History</h3>
        <div className="session-history">
          <p>You've completed {sessionHistory.length} therapy interactions</p>
          <button>View Detailed History</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

// File: src/components/UserProfile.js
import React, { useState, useContext } from 'react';
import { TherapyContext } from '../context/TherapyContext';

const UserProfile = () => {
  const { userProfile, updateProfile } = useContext(TherapyContext);
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({...userProfile});
  
  const therapeuticGoalOptions = [
    'anxiety-management',
    'mood-improvement',
    'stress-reduction',
    'relationship-skills',
    'self-esteem',
    'sleep-improvement',
    'work-life-balance'
  ];
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleGoalChange = (e) => {
    const value = e.target.value;
    
    if (formData.therapeuticGoals.includes(value)) {
      // Remove goal if already selected
      setFormData({
        ...formData,
        therapeuticGoals: formData.therapeuticGoals.filter(goal => goal !== value)
      });
    } else {
      // Add goal if not already selected
      setFormData({
        ...formData,
        therapeuticGoals: [...formData.therapeuticGoals, value]
      });
    }
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    updateProfile(formData);
    setEditMode(false);
  };

  return (
    <div className="user-profile">
      <h2>Your Therapy Profile</h2>
      
      {!editMode ? (
        <div className="profile-view">
          <div className="profile-section">
            <h3>Personal Information</h3>
            <p><strong>Name:</strong> {userProfile.name}</p>
          </div>
          
          <div className="profile-section">
            <h3>Therapeutic Goals</h3>
            <ul>
              {userProfile.therapeuticGoals.map((goal, index) => (
                <li key={index}>{goal}</li>
              ))}
            </ul>
          </div>
          
          <div className="profile-section">
            <h3>Current Stressors</h3>
            <ul>
              {userProfile.currentStressors.map((stressor, index) => (
                <li key={index}>{stressor}</li>
              ))}
            </ul>
          </div>
          
          <div className="profile-section">
            <h3>Preferences</h3>
            <p><strong>Session Frequency:</strong> Every {userProfile.sessionFrequency} days</p>
            <p><strong>Preferred Activity Duration:</strong> {userProfile.preferredDuration}</p>
            <p><strong>Preferred Activity Type:</strong> {userProfile.preferredActivityType}</p>
          </div>
          
          <button onClick={() => setEditMode(true)}>Edit Profile</button>
        </div>
      ) : (
        <form className="profile-edit-form" onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>Personal Information</h3>
            <div className="form-field">
              <label htmlFor="name">Name:</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          
          <div className="form-section">
            <h3>Therapeutic Goals</h3>
            <div className="checkbox-group">
              {therapeuticGoalOptions.map((goal, index) => (
                <div key={index} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`goal-${index}`}
                    value={goal}
                    checked={formData.therapeuticGoals.includes(goal)}
                    onChange={handleGoalChange}
                  />
                  <label htmlFor={`goal-${index}`}>{goal}</label>
                </div>
              ))}
            </div>
          </div>
          
          <div className="form-section">
            <h3>Current Stressors</h3>
            <textarea
              name="currentStressors"
              value={formData.currentStressors.join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                currentStressors: e.target.value.split(',').map(item => item.trim())
              })}
              placeholder="Enter your current stressors, separated by commas"
            />
          </div>
          
          <div className="form-section">
            <h3>Preferences</h3>
            <div className="form-field">
              <label htmlFor="sessionFrequency">Session Frequency (days):</label>
              <input
                type="number"
                id="sessionFrequency"
                name="sessionFrequency"
                min="1"
                max="30"
                value={formData.sessionFrequency}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-field">
              <label htmlFor="preferredDuration">Preferred Activity Duration:</label>
              <select
                id="preferredDuration"
                name="preferredDuration"
                value={formData.preferredDuration}
                onChange={handleChange}
              >
                <option value="5 min">5 minutes</option>
                <option value="10 min">10 minutes</option>
                <option value="15 min">15 minutes</option>
                <option value="20 min">20 minutes</option>
                <option value="30 min">30 minutes</option>
              </select>
            </div>
            
            <div className="form-field">
              <label htmlFor="preferredActivityType">Preferred Activity Type:</label>
              <select
                id="preferredActivityType"
                name="preferredActivityType"
                value={formData.preferredActivityType}
                onChange={handleChange}
              >
                <option value="exercise">Exercise</option>
                <option value="meditation">Meditation</option>
                <option value="journaling">Journaling</option>
                <option value="reading">Reading</option>
              </select>
            </div>
          </div>
          
          <div className="form-buttons">
            <button type="submit">Save Changes</button>
            <button type="button" onClick={() => setEditMode(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default UserProfile;

// File: src/components/Login.js
import React, { useState } from 'react';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    email: '',
    password: ''
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials({
      ...credentials,
      [name]: value
    });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(credentials);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Therapy Companion</h2>
        <p>Your personal mental wellness assistant</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="login-button">Log In</button>
        </form>
        
        <div className="login-options">
          <a href="#forgot-password">Forgot Password?</a>
          <a href="#create-account">Create Account</a>
        </div>
      </div>
    </div>
  );
};

export default Login;

// File: src/services/TherapyCompanionAgent.js
// This is a simplified version of the core agent for React frontend
// In a real app, most processing would happen on the backend

class TherapyCompanionAgent {
  constructor(userProfile) {
    this.userProfile = userProfile;
    this.sessionHistory = [];
    this.currentEmotionalState = this.initializeEmotionalState();
  }
  
  initializeEmotionalState() {
    return {
      overall: 5,
      anxiety: 5,
      depression: 5,
      anger: 5,
      joy: 5,
      timestamp: new Date()
    };
  }
  
  async startSession() {
    // Simulate API call
    await this.simulateDelay(500);
    
    // Generate greeting based on time of day and user profile
    const greeting = this.generateGreeting();
    
    // Generate focus areas based on user profile
    const focusAreas = this.userProfile.therapeuticGoals.slice(0, 2);
    
    // Generate suggested activities
    const suggestedActivities = this.generateSuggestedActivities(focusAreas);
    
    return {
      greeting,
      focusAreas,
      suggestedActivities
    };
  }
  
  async processUserInput(input) {
    // Simulate NLP processing
    await this.simulateDelay(700);
    
    // Check for safety concerns
    const safetyCheck = this.checkForSafetyConcerns(input);
    if (safetyCheck.concernDetected) {
      return this.generateSafetyResponse(safetyCheck);
    }
    
    // Update emotional state based on input
    this.updateEmotionalState(input);
    
    // Record interaction in session history
    this.recordInteraction(input, null); // Response will be added by UI
    
    // Analyze input for themes and needs
    const analysis = this.analyzeInput(input);
    
    // Generate appropriate response based on analysis
    return this.generateResponse(analysis);
  }
  
  async endSession() {
    // Simulate API call
    await this.simulateDelay(1000);
    
    // Generate session summary
    const summary = this.generateSessionSummary();
    
    // Suggest home activity
    const homeActivity = this.suggestHomeActivity();
    
    // Recommend next session
    const nextSessionRecommendation = this.suggestNextSession();
    
    return {
      summary,
      homeActivity,
      nextSessionRecommendation
    };
  }
  
  // Helper methods
  
  simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  generateGreeting() {
    const hour = new Date().getHours();
    let timeGreeting = "Hello";
    
    if (hour < 12) {
      timeGreeting = "Good morning";
    } else if (hour < 18) {
      timeGreeting = "Good afternoon";
    } else {
      timeGreeting = "Good evening";
    }
    
    const greetings = [
      `${timeGreeting}, ${this.userProfile.name}. How are you feeling today?`,
      `${timeGreeting}. I'm here to support you today. What's on your mind?`,
      `Welcome back, ${this.userProfile.name}. How have things been since we last spoke?`
    ];
    
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  
  generateSuggestedActivities(focusAreas) {
    const activityMap = {
      'anxiety-management': [
        { type: 'exercise', name: 'Progressive Muscle Relaxation', duration: '10 min' },
        { type: 'technique', name: '5-4-3-2-1 Grounding Exercise', duration: '5 min' }
      ],
      'mood-improvement': [
        { type: 'exercise', name: 'Gratitude Journal', duration: '5 min' },
        { type: 'technique', name: 'Positive Memory Recall', duration: '10 min' }
      ],
      'stress-reduction': [
        { type: 'meditation', name: 'Body Scan for Stress', duration: '12 min' },
        { type: 'technique', name: 'Stress Inventory Assessment', duration: '10 min' }
      ],
      'relationship-skills': [
        { type: 'exercise', name: 'Active Listening Practice', duration: '10 min' },
        { type: 'technique', name: 'Boundary Setting Script', duration: '15 min' }
      ]
    };
    
    const activities = [];
    focusAreas.forEach(area => {
      if (activityMap[area]) {
        activities.push(...activityMap[area]);
      }
    });
    
    return activities.slice(0, 3); // Limit to 3 activities
  }
  
  checkForSafetyConcerns(input) {
    const lowerInput = input.toLowerCase();
    
    // Check for suicide and self-harm keywords
    const suicideKeywords = ['kill myself', 'end my life', 'suicide', 'don\'t want to live'];
    const harmKeywords = ['hurt myself', 'self-harm', 'cutting', 'burn myself'];
    
    for (const keyword of suicideKeywords) {
      if (lowerInput.includes(keyword)) {
        return { 
          concernDetected: true, 
          severity: 'emergency',
          riskType: 'suicide'
        };
      }
    }
    
    for (const keyword of harmKeywords) {
      if (lowerInput.includes(keyword)) {
        return {
          concernDetected: true,
          severity: 'warning',
          riskType: 'self-harm'
        };
      }
    }
    
    return { concernDetected: false };
  }
  
  generateSafetyResponse(safetyCheck) {
    const emergencyResources = [
      {
        name: 'National Suicide Prevention Lifeline',
        contact: '1-800-273-8255',
        available: '24/7'
      },
      {
        name: 'Crisis Text Line',
        contact: 'Text HOME to 741741',
        available: '24/7'
      }
    ];
    
    if (safetyCheck.severity === 'emergency') {
      return {
        type: 'emergency',
        message: "I'm concerned about what you've shared. It sounds like you're going through a really difficult time, and it's important that you talk to a qualified professional right away.",
        resources: emergencyResources,
        instructions: "Please reach out to one of these resources immediately. They're available 24/7 and are trained to help with exactly what you're experiencing."
      };
    } else {
      return {
        type: 'resource',
        message: "I'm concerned about what you've shared. While we can continue our conversation, I also want to make sure you have access to additional support if needed.",
        resources: emergencyResources,
        continuePrompt: "Would you like to continue our conversation or would it be helpful to discuss strategies for managing these difficult feelings?"
      };
    }
  }
  