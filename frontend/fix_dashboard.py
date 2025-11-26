#!/usr/bin/env python3
"""
Fix Dashboard.jsx by adding ConsultantFinder and RecommendationPanel components
"""

import re

# Read the current Dashboard.jsx
with open('src/components/Dashboard.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check if components are already imported
if 'import ConsultantFinder' not in content:
    # Find the dashboardUtils import and add our imports after it
    content = content.replace(
        '} from "../utils/dashboardUtils";',
        '''} from "../utils/dashboardUtils";

import ConsultantFinder from "./ConsultantFinder";
import RecommendationPanel from "./RecommendationPanel";'''
    )
    print("✓ Added component imports")
else:
    print("✓ Component imports already exist")

# Check if components are already in the render
if '<ConsultantFinder />' not in content:
    # Find the closing tags before the final StatCard function
    # Look for the pattern: sessions list closing + main div closing + function closing
    pattern = r'(\s+</motion\.div>\s+</div>\s+\);\s+}\s+// ------------------ STAT CARD ------------------)'
    
    replacement = r'''      </motion.div>

      {/* AI RECOMMENDATIONS WITH EMOTION CONTEXT */}
      <motion.div className="mt-8" variants={itemVariants}>
        <RecommendationPanel
          stressScore={sessions.length > 0 ? sessions[0].averageScore : null}
          emotionData={sessions.length > 0 ? (sessions[0].dashboard_data || sessions[0].detected_emotions) : {}}
          emotionSummary={emotionPie.slice(0, 3).map(e => `${e.name} (${e.value}%)`).join(", ")}
          autoRefresh={true}
        />
      </motion.div>

      {/* CONSULTANT FINDER */}
      <motion.div className="mt-8" variants={itemVariants}>
        <ConsultantFinder />
      </motion.div>
    </div>
  );
}

// ------------------ STAT CARD ------------------'''
    
    if re.search(pattern, content):
        content = re.sub(pattern, replacement, content)
        print("✓ Added components to render")
    else:
        print("✗ Could not find insertion point - file may be corrupted")
        print("  Trying alternative pattern...")
        
        # Alternative: just find the last </motion.div> before StatCard
        alt_pattern = r'(</motion\.div>\s+</div>\s+\);\s+}\s+// ------------------ STAT CARD)'
        if re.search(alt_pattern, content):
            alt_replacement = r'''</motion.div>

      {/* AI RECOMMENDATIONS */}
      <motion.div className="mt-8" variants={itemVariants}>
        <RecommendationPanel
          stressScore={sessions.length > 0 ? sessions[0].averageScore : null}
          emotionData={sessions.length > 0 ? (sessions[0].dashboard_data || sessions[0].detected_emotions) : {}}
          emotionSummary={emotionPie.slice(0, 3).map(e => `${e.name} (${e.value}%)`).join(", ")}
          autoRefresh={true}
        />
      </motion.div>

      {/* CONSULTANT FINDER */}
      <motion.div className="mt-8" variants={itemVariants}>
        <ConsultantFinder />
      </motion.div>
    </div>
  );
}

// ------------------ STAT CARD'''
            content = re.sub(alt_pattern, alt_replacement, content)
            print("✓ Added components using alternative pattern")
        else:
            print("✗ File is too corrupted, needs manual fix")
            exit(1)
else:
    print("✓ Components already in render")

# Write the fixed content
with open('src/components/Dashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ Dashboard.jsx fixed successfully!")
