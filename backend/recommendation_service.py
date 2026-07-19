import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)

class RecommendationService:
    """
    Generates personalized wellness recommendations based on stress levels,
    emotions, and user context using Gemini AI.
    """
    
    def __init__(self, groq_client=None):
        self.groq_client = groq_client
        self.groq_model = "llama-3.1-8b-instant"
        
        # Crisis keywords for detection
        self.crisis_keywords = [
            "suicide", "suicidal", "kill myself", "end my life", "want to die",
            "hurt myself", "self harm", "no reason to live", "better off dead",
            "panic attack", "can't breathe", "overwhelming", "can't cope"
        ]
        
        # Helpline information (India-specific)
        self.helplines = {
            "india": {
                "name": "AASRA Suicide Prevention Helpline",
                "phone": "+91-9820466726",
                "hours": "24/7"
            },
            "emergency": {
                "name": "Emergency Services",
                "phone": "112",
                "hours": "24/7"
            }
        }
    
    def generate_recommendations(
        self, 
        stress_score: int, 
        emotion_data: Dict[str, float],
        session_context: Optional[Dict[str, Any]] = None,
        user_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate personalized recommendations based on current stress and emotion data.
        
        Args:
            stress_score: Current stress level (0-100)
            emotion_data: Dictionary of detected emotions and their percentages
            session_context: Optional context like time of day, previous sessions, etc.
            user_text: Optional user text input for crisis keyword detection
        
        Returns:
            Dictionary containing categorized recommendations
        """
        # CRISIS DETECTION - Highest priority
        crisis_detected = self._detect_crisis(stress_score, user_text)
        if crisis_detected:
            return self._get_crisis_recommendations(stress_score)
        
        if not self.groq_client:
            return self._get_fallback_recommendations(stress_score, emotion_data)
        
        try:
            # Build a detailed prompt for Groq
            prompt = self._build_recommendation_prompt(stress_score, emotion_data, session_context)
            
            # Call Groq API
            response = self.groq_client.models.generate_content(
                model=self.groq_model,
                contents=prompt
            )
            
            ai_text = response.text
            
            # Parse AI response into structured format
            recommendations = self._parse_ai_recommendations(ai_text, stress_score)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error generating AI recommendations: {e}")
            return self._get_fallback_recommendations(stress_score, emotion_data)
    
    def _build_recommendation_prompt(
        self, 
        stress_score: int, 
        emotion_data: Dict[str, float],
        session_context: Optional[Dict[str, Any]]
    ) -> str:
        """Build a concise prompt for Groq AI."""
        
        # Get top emotions
        top_emotions = sorted(emotion_data.items(), key=lambda x: x[1], reverse=True)[:3]
        emotion_summary = ", ".join([f"{emotion} ({pct:.1f}%)" for emotion, pct in top_emotions])
        
        # Determine stress level category
        if stress_score < 30:
            stress_level = "low"
        elif stress_score < 60:
            stress_level = "moderate"
        else:
            stress_level = "high"
        
        prompt = f"""You are a wellness advisor. Generate SHORT, ACTIONABLE recommendations for stress relief.

USER STATE:
- Stress: {stress_score}% ({stress_level})
- Top Emotions: {emotion_summary}

TASK: Provide 4-6 BRIEF recommendations (1 sentence each):

IMMEDIATE ACTION:
- [Action 1]
- [Action 2]

WELLNESS ACTIVITIES:
- [Activity 1]
- [Activity 2]

{"PROFESSIONAL SUPPORT:" if stress_score >= 60 else ""}
{"- [Support option]" if stress_score >= 60 else ""}

RULES:
- Keep each item to ONE sentence
- Be specific (e.g., "Take 10 deep breaths" not "Try breathing")
- Match recommendations to emotions
- For high stress, emphasize professional help
"""
        
        return prompt
    
    def _parse_ai_recommendations(self, ai_text: str, stress_score: int) -> Dict[str, Any]:
        """Parse AI response into structured format."""
        
        recommendations = {
            "stress_score": stress_score,
            "immediate_actions": [],
            "wellness_activities": [],
            "professional_support": [],
            "raw_response": ai_text
        }
        
        try:
            lines = ai_text.strip().split('\n')
            current_category = None
            
            for line in lines:
                line = line.strip()
                
                if not line:
                    continue
                
                # Detect category headers
                if "IMMEDIATE ACTION" in line.upper():
                    current_category = "immediate_actions"
                elif "WELLNESS ACTIVIT" in line.upper():
                    current_category = "wellness_activities"
                elif "PROFESSIONAL SUPPORT" in line.upper():
                    current_category = "professional_support"
                # Parse bullet points
                elif line.startswith('-') or line.startswith('•') or line.startswith('*'):
                    if current_category:
                        # Remove bullet point and clean up
                        item = line.lstrip('-•* ').strip()
                        if item:
                            recommendations[current_category].append(item)
            
            # Ensure we have at least some recommendations
            if not any([
                recommendations["immediate_actions"],
                recommendations["wellness_activities"],
                recommendations["professional_support"]
            ]):
                # Fallback: split by lines and categorize
                return self._get_fallback_recommendations(stress_score, {})
            
        except Exception as e:
            logger.error(f"Error parsing AI recommendations: {e}")
            return self._get_fallback_recommendations(stress_score, {})
        
        return recommendations
    
    def _get_fallback_recommendations(
        self, 
        stress_score: int, 
        emotion_data: Dict[str, float]
    ) -> Dict[str, Any]:
        """Provide rule-based recommendations when AI is unavailable."""
        
        recommendations = {
            "stress_score": stress_score,
            "immediate_actions": [],
            "wellness_activities": [],
            "professional_support": []
        }
        
        # Extended pool of recommendations for randomization
        import random
        
        # Immediate actions pool
        immediate_pool_low = [
            "Take a moment to appreciate your current calm state",
            "Practice gratitude by listing 3 things you're thankful for",
            "Stretch your body gently for 2-3 minutes",
            "Drink a glass of water to stay hydrated",
            "Take 5 deep, conscious breaths",
            "Look away from screens for 20 seconds at something 20 feet away"
        ]
        
        immediate_pool_moderate = [
            "Take 10 slow, deep breaths (4 seconds in, 6 seconds out)",
            "Step away from your screen for a 5-minute walk",
            "Listen to calming music or nature sounds",
            "Do a quick body scan to release tension in shoulders and jaw",
            "Splash cold water on your face",
            "Squeeze a stress ball or clench and release your fists"
        ]
        
        immediate_pool_high = [
            "Practice the 4-7-8 breathing technique: inhale for 4, hold for 7, exhale for 8",
            "Find a quiet space and close your eyes for 5 minutes",
            "Drink a glass of water and do gentle neck rolls",
            "Try the '5-4-3-2-1' grounding technique",
            "Put on noise-cancelling headphones with white noise",
            "Do 10 jumping jacks to release nervous energy"
        ]
        
        # Wellness activities pool
        wellness_pool = [
            "Schedule 20-30 minutes of physical exercise today",
            "Try a guided meditation session (apps like Headspace or Calm)",
            "Journal about your feelings for 10 minutes",
            "Connect with a friend or loved one",
            "Spend 15 minutes reading a book (not a screen)",
            "Take a warm bath or shower before bed",
            "Go for a mindful walk in nature",
            "Practice yoga or stretching for 15 minutes",
            "Write down your top 3 priorities for tomorrow to clear your mind",
            "Cook a healthy meal from scratch"
        ]
        
        # Professional support pool
        support_pool = [
            "Consider speaking with a mental health professional if stress persists",
            "Explore online therapy platforms like BetterHelp or Talkspace",
            "Contact your employee assistance program (EAP) if available",
            "Look for local support groups for stress management",
            "Read articles on cognitive behavioral therapy (CBT) techniques"
        ]

        # Select random items
        if stress_score < 30:
            recommendations["immediate_actions"] = random.sample(immediate_pool_low, min(3, len(immediate_pool_low)))
        elif stress_score < 60:
            recommendations["immediate_actions"] = random.sample(immediate_pool_moderate, min(3, len(immediate_pool_moderate)))
        else:
            recommendations["immediate_actions"] = random.sample(immediate_pool_high, min(3, len(immediate_pool_high)))
        
        recommendations["wellness_activities"] = random.sample(wellness_pool, min(4, len(wellness_pool)))
        
        # Professional support (for moderate to high stress)
        if stress_score >= 40:
            recommendations["professional_support"] = random.sample(support_pool, min(3, len(support_pool)))
        
        if stress_score >= 70:
            recommendations["professional_support"].insert(0,
                "Your stress level is high. Please consider reaching out to a counselor or therapist soon"
            )
        
        return recommendations
    
    def _detect_crisis(self, stress_score: int, user_text: Optional[str] = None) -> bool:
        """
        Detect if user is in crisis based on stress score or keywords.
        
        Args:
            stress_score: Current stress level (0-100)
            user_text: Optional user text input
        
        Returns:
            True if crisis detected, False otherwise
        """
        # Threshold-based detection
        if stress_score >= 85:
            logger.warning(f"Crisis detected: High stress score ({stress_score})")
            return True
        
        # Keyword-based detection
        if user_text:
            user_text_lower = user_text.lower()
            for keyword in self.crisis_keywords:
                if keyword in user_text_lower:
                    logger.warning(f"Crisis detected: Keyword '{keyword}' found in text")
                    return True
        
        return False
    
    def _get_crisis_recommendations(self, stress_score: int) -> Dict[str, Any]:
        """
        Return crisis-specific recommendations with helpline information.
        
        Args:
            stress_score: Current stress level
        
        Returns:
            Crisis recommendations with helpline details
        """
        return {
            "stress_score": stress_score,
            "is_crisis": True,
            "severity": "high",
            "immediate_actions": [
                "Please reach out to someone you trust right now",
                "Contact a mental health professional immediately",
                "Call the helpline numbers below - they are available 24/7"
            ],
            "wellness_activities": [],
            "professional_support": [
                f"🆘 {self.helplines['india']['name']}: {self.helplines['india']['phone']} ({self.helplines['india']['hours']})",
                f"🚨 {self.helplines['emergency']['name']}: {self.helplines['emergency']['phone']}",
                "You are not alone. Professional help is available and effective"
            ],
            "helplines": self.helplines
        }


# Singleton instance
recommendation_service = None

def get_recommendation_service(groq_client=None):
    """Get or create the recommendation service singleton."""
    global recommendation_service
    if recommendation_service is None:
        recommendation_service = RecommendationService(groq_client)
    return recommendation_service
