// src/components/TherapyCompanion/index.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Container, Paper, Typography, Box, Button, TextField, CircularProgress } from '@mui/material';
import SessionStart from './SessionStart';
import ChatInterface from './ChatInterface';
import SessionEnd from './SessionEnd';
import EmotionTracker from '../../services/EmotionTracker';
import InterventionEngine from '../../services/InterventionEngine';
import ResourceManager from '../../services/ResourceManager';
import ProgressTracker from '../../services/ProgressTracker';
import SafetyModule from '../../services/SafetyModule';
import NLPProcessor from '../../services/NLPProcessor';

// Main component for the Therapy Companion Agent
const TherapyCompanion = ({ userId }) => {
  // Session states
  const [sessionState, setSessionState] = useState('idle'); // idle, starting, active, ending, complete
  const [sessionData, setSessionData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Service instances
  const emotionTracker = useRef(new EmotionTracker());
  const interventionEngine = useRef(new InterventionEngine());
  const resourceManager = useRef(new ResourceManager());
  const progressTracker = useRef(new ProgressTracker());
  const safetyModule = useRef(new SafetyModule());
  const nlpProcessor = useRef(new NLPProcessor());

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // In a real app, this would be an API call
        const response = await fetch(`/api/users/${userId}/profile`);
        if (!response.ok) throw new Error('Failed to load user profile');
        const data = await response.json();
        setUserProfile(data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Start a new therapy session
  const startSession = async () => {
    setSessionState('starting');
    try {
      const currentMood = await emotionTracker.current.assessCurrentState();
      const sessionContext = createSessionContext(currentMood);
      const sessionPlan = generateSessionPlan(sessionContext);
      
      const newSessionData = {
        id: Date.now().toString(),
        startTime: new Date(),
        currentMood,
        sessionPlan
      };
      
      setSessionData(newSessionData);
      
      // Add initial greeting message
      const greeting = generateGreeting(currentMood);
      addMessage('agent', {
        text: greeting,
        focusAreas: sessionPlan.focusAreas,
        suggestedActivities: sessionPlan.suggestedActivities
      });
      
      setSessionState('active');
    } catch (err) {
      setError('Failed to start session: ' + err.message);
      setSessionState('idle');
    }
  };

  // Process user message
  const processUserMessage = async (messageText) => {
    // Add user message to chat
    addMessage('user', { text: messageText });
    
    try {
      // Process the message
      const analyzedInput = await nlpProcessor.current.analyze(messageText);
      
      // Check for safety concerns
      const safetyCheck = safetyModule.current.evaluateSafety(analyzedInput);
      if (safetyCheck.concernDetected) {
        const safetyResponse = handleSafetyConcern(safetyCheck);
        addMessage('agent', safetyResponse);
        return;
      }
      
      // Update emotion tracking
      const updatedState = await emotionTracker.current.updateEmotionalState(analyzedInput.emotions);
      
      // Select appropriate intervention
      const intervention = interventionEngine.current.selectIntervention(
        analyzedInput,
        userProfile,
        updatedState
      );
      
      // Add agent response to chat
      addMessage('agent', intervention);
      
      // Record interaction in session history
      recordInteraction(messageText, intervention);
    } catch (err) {
      setError('Error processing message: ' + err.message);
      addMessage('agent', { 
        text: "I'm sorry, I'm having trouble processing that. Could you try rephrasing or sharing something else?" 
      });
    }
  };

  // End the current session
  const endSession = async () => {
    setSessionState('ending');
    try {
      const sessionSummary = generateSessionSummary();
      const progressUpdate = progressTracker.current.updateProgress(messages);
      const homeActivity = resourceManager.current.suggestHomeActivity(userProfile, progressUpdate);
      
      const endSessionData = {
        summary: sessionSummary,
        progressInsights: progressUpdate,
        homeActivity: homeActivity,
        nextSessionRecommendation: suggestNextSession()
      };
      
      setSessionData({
        ...sessionData,
        endTime: new Date(),
        ...endSessionData
      });
      
      setSessionState('complete');
    } catch (err) {
      setError('Failed to end session: ' + err.message);
      setSessionState('active');
    }
  };

  // Helper methods
  const createSessionContext = (currentMood) => {
    return {
      mood: currentMood,
      recentSessions: [], // This would come from an API in a real app
      userGoals: userProfile?.therapeuticGoals || [],
      currentStressors: userProfile?.currentStressors || []
    };
  };

  const generateSessionPlan = (context) => {
    // Create a personalized session plan based on context
    const focusAreas = determineFocusAreas(context);
    const activities = resourceManager.current.selectActivities(focusAreas, context);
    
    return {
      focusAreas: focusAreas,
      suggestedActivities: activities
    };
  };

  const determineFocusAreas = (context) => {
    // Determine therapeutic focus areas based on context
    let areas = [];
    
    if (context.mood.anxiety > 6) {
      areas.push('anxiety-management');
    }
    
    if (context.mood.depression > 5) {
      areas.push('mood-improvement');
    }
    
    if (context.recentSessions.some(s => s.focusedOn === 'communication')) {
      areas.push('relationship-skills');
    }
    
    // Add at least one focus area if none detected
    if (areas.length === 0) {
      areas.push(userProfile?.primaryGoal || 'general-wellbeing');
    }
    
    return areas;
  };

  const generateGreeting = (mood) => {
    // Generate personalized greeting based on user's mood
    if (mood.overall < 4) {
      return `I notice you might be having a tough day. How can I support you right now?`;
    } else if (mood.overall > 7) {
      return `It's great to see you! It seems like things might be going well. Would you like to build on that positive momentum?`;
    } else {
      return `Welcome back. How have things been since we last spoke?`;
    }
  };

  const addMessage = (sender, content) => {
    setMessages(prevMessages => [...prevMessages, {
      id: Date.now().toString(),
      sender,
      content,
      timestamp: new Date()
    }]);
  };

  const recordInteraction = (input, response) => {
    // In a real app, this might also send data to a backend API
    const interaction = {
      timestamp: new Date(),
      userInput: input,
      agentResponse: response,
      emotionalState: emotionTracker.current.getCurrentState()
    };
    
    // Update session data
    setSessionData(prevData => ({
      ...prevData,
      interactions: [...(prevData.interactions || []), interaction]
    }));
  };

  const generateSessionSummary = () => {
    // Generate summary of the current session
    const sessionMessages = messages.slice(-20); // Get current session interactions
    
    // Extract key themes, progress, insights
    const themes = nlpProcessor.current.extractKeyThemes(sessionMessages);
    const insights = nlpProcessor.current.extractInsights(sessionMessages);
    
    return {
      duration: calculateSessionDuration(),
      mainThemes: themes,
      keyInsights: insights,
      emotionalJourney: emotionTracker.current.summarizeEmotionalJourney()
    };
  };

  const calculateSessionDuration = () => {
    if (!sessionData || !sessionData.startTime) return 0;
    
    const start = sessionData.startTime;
    const end = new Date();
    return (end - start) / 1000 / 60; // Duration in minutes
  };

  const suggestNextSession = () => {
    // Algorithm to suggest optimal time for next session
    const userPreferredInterval = userProfile?.sessionFrequency || 7; // Default 7 days
    const urgencyFactor = assessUrgencyFactor();
    
    let recommendedDays = userPreferredInterval;
    if (urgencyFactor > 0.7) {
      recommendedDays = Math.max(1, Math.floor(userPreferredInterval / 2));
    } else if (urgencyFactor < 0.3) {
      recommendedDays = userPreferredInterval + 2;
    }
    
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + recommendedDays);
    
    return {
      recommendedDate: nextDate,
      recommendedFocus: suggestNextFocus()
    };
  };

  const assessUrgencyFactor = () => {
    // Assess how urgent the next session should be
    const emotionalState = emotionTracker.current.getCurrentState();
    const recentProgress = progressTracker.current.getRecentTrend();
    
    // Algorithm to calculate urgency factor (0-1)
    const emotionalUrgency = (10 - emotionalState.overall) / 10;
    const progressUrgency = recentProgress < 0 ? 0.6 : 0.4;
    
    return (emotionalUrgency * 0.7) + (progressUrgency * 0.3);
  };

  const suggestNextFocus = () => {
    // Suggest focus area for next session
    const recentFocus = messages
      .filter(m => m.sender === 'agent' && m.content.focusArea)
      .slice(-3)
      .map(m => m.content.focusArea);
      
    const userGoals = userProfile?.therapeuticGoals || ['general-wellbeing'];
    
    // Find important goals not recently addressed
    return userGoals.find(goal => !recentFocus.includes(goal)) || userGoals[0];
  };

  const handleSafetyConcern = (safetyCheck) => {
    // Handle detected safety concerns
    if (safetyCheck.severity === 'emergency') {
      return safetyModule.current.generateEmergencyResponse();
    } else if (safetyCheck.severity === 'warning') {
      return safetyModule.current.generateResourceResponse();
    } else {
      return safetyModule.current.generateSupportiveResponse();
    }
  };

  // Render appropriate view based on session state
  const renderSessionView = () => {
    switch (sessionState) {
      case 'idle':
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h5" gutterBottom>
              Ready for a new session?
            </Typography>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={startSession}
              sx={{ mt: 2 }}
            >
              Start Session
            </Button>
          </Box>
        );
      case 'starting':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        );
      case 'active':
        return (
          <ChatInterface 
            messages={messages} 
            onSendMessage={processUserMessage}
            onEndSession={endSession}
          />
        );
      case 'ending':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        );
      case 'complete':
        return (
          <SessionEnd 
            sessionData={sessionData}
            onStartNewSession={() => {
              setMessages([]);
              setSessionData(null);
              setSessionState('idle');
            }}
          />
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Paper sx={{ p: 3, mt: 4, backgroundColor: '#fff4f4' }}>
          <Typography color="error">Error: {error}</Typography>
          <Button 
            variant="outlined" 
            color="primary" 
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Retry
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Therapy Companion
        </Typography>
        {renderSessionView()}
      </Paper>
    </Container>
  );
};

export default TherapyCompanion;

// src/components/TherapyCompanion/ChatInterface.jsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  Button, 
  List, 
  ListItem, 
  Typography,
  Divider,
  IconButton
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import StopIcon from '@mui/icons-material/Stop';
import MessageBubble from './MessageBubble';

const ChatInterface = ({ messages, onSendMessage, onEndSession }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <List>
          {messages.map((message) => (
            <ListItem key={message.id} sx={{ justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start' }}>
              <MessageBubble message={message} />
            </ListItem>
          ))}
          <div ref={messagesEndRef} />
        </List>
      </Box>
      
      <Divider />
      
      <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, backgroundColor: 'background.default' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder="Type your message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Button
            variant="contained"
            color="primary"
            endIcon={<SendIcon />}
            type="submit"
            disabled={!inputText.trim()}
          >
            Send
          </Button>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<StopIcon />}
            onClick={onEndSession}
          >
            End Session
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatInterface;

// src/components/TherapyCompanion/MessageBubble.jsx
import React from 'react';
import { Paper, Typography, Box, Chip, List, ListItem, ListItemText } from '@mui/material';

const MessageBubble = ({ message }) => {
  const isUser = message.sender === 'user';
  
  const renderContent = () => {
    if (isUser) {
      return (
        <Typography variant="body1">{message.content.text}</Typography>
      );
    }
    
    // Agent messages can have different types of content
    const content = message.content;
    
    // For safety responses
    if (content.type === 'emergency' || content.type === 'resource' || content.type === 'supportive') {
      return (
        <Box>
          <Typography variant="body1" sx={{ mb: 1 }}>{content.message}</Typography>
          
          {content.resources && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle2">Resources:</Typography>
              <List dense>
                {content.resources.map((resource, idx) => (
                  <ListItem key={idx}>
                    <ListItemText 
                      primary={resource.name} 
                      secondary={`${resource.contact} (${resource.available})`} 
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
          
          {content.instructions && (
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'medium' }}>
              {content.instructions}
            </Typography>
          )}
          
          {content.continuePrompt && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {content.continuePrompt}
            </Typography>
          )}
          
          {content.supportiveContent && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              {content.supportiveContent}
            </Typography>
          )}
        </Box>
      );
    }
    
    // For therapeutic interventions
    if (content.title) {
      return (
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
            {content.title}
          </Typography>
          
          {content.introduction && (
            <Typography variant="body1" sx={{ mb: 1 }}>
              {content.introduction}
            </Typography>
          )}
          
          {content.content && (
            <Typography variant="body1" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>
              {content.content}
            </Typography>
          )}
          
          {content.followUp && (
            <Typography variant="body1" sx={{ mt: 1, fontStyle: 'italic' }}>
              {content.followUp}
            </Typography>
          )}
        </Box>
      );
    }
    
    // Standard text message
    return (
      <Box>
        <Typography variant="body1">{content.text}</Typography>
        
        {content.focusAreas && content.focusAreas.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              Focus areas:
            </Typography>
            {content.focusAreas.map((area, idx) => (
              <Chip
                key={idx}
                label={formatAreaName(area)}
                size="small"
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Box>
        )}
        
        {content.suggestedActivities && content.suggestedActivities.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              Suggested activities:
            </Typography>
            <List dense>
              {content.suggestedActivities.slice(0, 2).map((activity, idx) => (
                <ListItem key={idx}>
                  <ListItemText 
                    primary={activity.name} 
                    secondary={activity.duration || activity.readTime} 
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
    );
  };
  
  const formatAreaName = (technicalName) => {
    // Convert technical area names to user-friendly names
    const nameMap = {
      'anxiety-management': 'Anxiety Management',
      'mood-improvement': 'Mood Improvement',
      'relationship-skills': 'Relationship Skills',
      'stress-reduction': 'Stress Reduction',
      'general-wellbeing': 'General Wellbeing'
    };
    
    return nameMap[technicalName] || technicalName;
  };

  return (
    <Paper 
      elevation={1} 
      sx={{
        p: 2,
        maxWidth: '70%',
        backgroundColor: isUser ? 'primary.light' : 'background.paper',
        color: isUser ? 'primary.contrastText' : 'text.primary',
        borderRadius: isUser ? '20px 20px 0 20px' : '20px 20px 20px 0',
      }}
    >
      {renderContent()}
      <Typography variant="caption" sx={{ display: 'block', mt: 1, textAlign: 'right', opacity: 0.7 }}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Typography>
    </Paper>
  );
};

export default MessageBubble;

// src/components/TherapyCompanion/SessionEnd.jsx
import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const SessionEnd = ({ sessionData, onStartNewSession }) => {
  if (!sessionData) return null;
  
  const { summary, progressInsights, homeActivity, nextSessionRecommendation } = sessionData;
  
  // Format date for next session
  const formatNextSessionDate = (date) => {
    if (!date) return 'Not specified';
    return new Date(date).toLocaleDateString(undefined, { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <Box sx={{ py: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Session Summary
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Session Overview
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Duration: {Math.round(summary.duration)} minutes
          </Typography>
          
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Main Themes
          </Typography>
          <List dense>
            {summary.mainThemes.map((theme, idx) => (
              <ListItem key={idx}>
                <ListItemText primary={theme} />
              </ListItem>
            ))}
          </List>
          
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Key Insights
          </Typography>
          <List dense>
            {summary.keyInsights.map((insight, idx) => (
              <ListItem key={idx}>
                <ListItemText primary={insight} />
              </ListItem>
            ))}
          </List>
          
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Emotional Journey
          </Typography>
          <Typography variant="body2">
            Overall trend: {summary.emotionalJourney.trend}
          </Typography>
          {summary.emotionalJourney.changes.length > 0 && (
            <List dense>
              {summary.emotionalJourney.changes.map((change, idx) => (
                <ListItem key={idx}>
                  <ListItemText 
                    primary={`${change.emotion} ${change.direction} (${change.magnitude.toFixed(1)} points)`} 
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Home Practice Activity</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" gutterBottom>
            {homeActivity.recommendation}
          </Typography>
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                {homeActivity.activity.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Type: {homeActivity.activity.type} | Duration: {homeActivity.activity.duration || homeActivity.activity.readTime}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                {homeActivity.instructions}
              </Typography>
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Next Session Recommendation</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="body1" gutterBottom>
            Recommended date: {formatNextSessionDate(nextSessionRecommendation.recommendedDate)}
          </Typography>
          <Typography variant="body1">
            Suggested focus: {nextSessionRecommendation.recommendedFocus}
          </Typography>
        </AccordionDetails>
      </Accordion>
      
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={onStartNewSession}
        >
          Start New Session
        </Button>
      </Box>
    </Box>
  );
};

export default SessionEnd;

// src/services/EmotionTracker.js
class EmotionTracker {
  constructor() {
    this.emotionalStates = [];
    this.currentState = this.initializeEmotionalState();
  }
  
  initializeEmotionalState() {
    return {
      overall: 5, // 1-10 scale
      anxiety: 5,
      depression: 5,
      anger: 5,
      joy: 5,
      timestamp: new Date()
    };
  }
  
  async assessCurrentState() {
    // In a real app, could connect to external API or use self-reporting
    // For demo, we'll simulate some variation in the initial state
    const variation = Math.random() * 2 - 1; // Random between -1 and 1
    
    return {
      ...this.currentState,
      overall: Math.max(1, Math.min(10, this.currentState.overall + variation)),
      timestamp: new Date()
    };
  }
  
  updateEmotionalState(detectedEmotions) {
    // In a real app, detectedEmotions would come from NLP analysis
    // For demo, we'll generate some random emotions if none provided
    const emotions = detectedEmotions || this.generateRandomEmotions();
    
    // Update the current emotional state based on detected emotions
    const newState = { ...this.currentState, timestamp: new Date() };
    
    // Update each emotion dimension
    for (const [emotion, value] of Object.entries(emotions)) {
      if (newState.hasOwnProperty(emotion)) {
        // Weighted update (70% new data, 30% historical)
        newState[emotion] = (value * 0.7) + (newState[emotion] * 0.3);
      }
    }
    
    // Recalculate overall score
    const emotionValues = Object.entries(newState)
      .filter(([key]) => key !== 'timestamp' && key !== 'overall')
      .map(([_, value]) => value);
    
    newState.overall = emotionValues.reduce((sum, val) => sum + val, 0) / emotionValues.length;
    
    // Save the new state
    this.emotionalStates.push(newState);
    this.currentState = newState;
    
    return newState;
  }
  
  generateRandomEmotions() {
    // Helper method to generate random emotions for demo purposes
    return {
      anxiety: Math.random() * 10,
      depression: Math.random() * 10,
      anger: Math.random() * 10,
      joy: Math.random() * 10
    };
  }
  
  getCurrentState() {
    return this.currentState;
  }
  
  summarizeEmotionalJourney() {
    // Analyze emotional progression through the session
    if (this.emotionalStates.length < 2) {
      return { trend: 'neutral', changes: [] };
    }
    
    const first = this.emotionalStates[0];
    const last = this.emotionalStates[this.emotionalStates.length - 1];
    
    // Calculate overall trend
    const overallChange = last.overall - first.overall;
    let trend = 'neutral';
    if (overallChange > 1) trend = 'improved';
    if (overallChange < -1) trend = 'declined';
    
    // Identify significant emotional changes
    const changes = [];
    for (const emotion of ['anxiety', 'depression', 'anger', 'joy']) {
      const change = last[emotion] - first[emotion];
      if (Math.abs(change) > 1.5) {
        changes.push({
          emotion: emotion,
          direction: change > 0 ? 'increased' : 'decreased',
          magnitude: Math.abs(change)
        });
      }
    }
    
    return { trend, changes };
  }
}

export default EmotionTracker;

// Additional service files would follow similar patterns...
// src/services/InterventionEngine.js
// src/services/ResourceManager.js
// src/services/ProgressTracker.js
// src/services/SafetyModule.js
// src/services/NLPProcessor.js
