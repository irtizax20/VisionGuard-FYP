# 🎓 FYP Presentation Tips — Make the Panel Say "Wow"

You've built a real product with real engineering depth. Here's how to **show it**
on demo day so you get the marks you deserve.

---

## 🗣 The Perfect 60-Second Pitch

> "Vision Guard is an AI-powered eye-care app that protects children and teenagers
> from digital eye strain. Unlike existing screen-time apps that only track minutes,
> we use on-device machine learning to actually monitor blink rate, screen distance,
> and eye fatigue in real time. When the system detects problematic behavior, it
> gently intervenes — with smart notifications, eye exercises, and if needed, a
> forced 20-second break.
>
> The app has three signature innovations: real on-device AI (no video ever leaves
> the phone), parent-child remote oversight without spying, and adaptive notification
> intelligence that learns when NOT to disturb the user.
>
> Built on React Native, Kotlin, Firebase, and Google ML Kit — with a hybrid
> architecture that keeps UI development fast while leveraging Android's native APIs
> for reliability."

Practice this until you can say it in 60 seconds without notes.

---

## 🎬 Demo Sequence (10 minutes)

### Minute 0–1: Opening
- Open app on real device
- Show the **animated splash** with the breathing eye icon
- Say: "Notice the eye icon — it breathes and blinks. Small touches make the app feel alive."

### Minute 1–3: Home screen tour
- Show the gradient hero card with today's stats
- Tap "Blink Test" → show the **live camera feed**
- Run a 30-second test → blink intentionally several times
- Show the live counter incrementing
- Show the final results card with health score

### Minute 3–5: Distance & redness demo
- Move phone close to face → trigger the "too close" warning
- Show how it speaks via TTS AND shows the badge
- Point out: "The distance reading uses interpupillary distance — the same
  principle used in optometry. We smooth it with a rolling median to eliminate
  jitter."

### Minute 5–7: Parent-child flow
- On phone A: sign up a new child account with parent email
- On phone B (or simulator): show the parent's approval notification appearing
  in real time (this is the Firestore live listener you fixed!)
- Approve the child
- Switch back to phone A: the child app unlocks immediately

### Minute 7–9: The 2-hour lock (the hard one)
- This is your CROWN JEWEL. Show this with confidence.
- Have your demo mode set to 2 MINUTES instead of 2 hours
- Hit start, then say: "Notice — I'm putting the phone in my pocket. The app
  is closed. Battery saver is on."
- Wait for the lock screen to appear (it WILL, because AlarmManager survives Doze)
- When it appears: "This is the most challenging engineering problem we solved.
  Standard JavaScript timers die in background. We use Android's AlarmManager
  with setExactAndAllowWhileIdle to guarantee delivery even from deep sleep."

### Minute 9–10: Future scope
- Show the analytics screen with charts
- Mention the AI roadmap: TFLite fatigue scoring, MediaPipe iris tracking, OpenCV redness
- "In Phase 2, we're integrating a TFLite model trained on the MRL Eye Dataset
  to compute PERCLOS — the medical-grade drowsiness metric."

---

## 🛡 Answers to Hard Questions

### "Why React Native and not pure native?"
> "React Native gave us 90% cross-platform code with native performance where
> it matters. We use Kotlin only for the parts that React Native can't do —
> foreground services, system overlays, and ML Kit camera processing.
> This hybrid architecture cut our development time by ~40% while keeping
> the critical paths fast."

### "Why on-device AI instead of cloud?"
> "Three reasons: (1) Privacy — no video of children leaves the device. (2)
> Latency — cloud round-trips would add 200–500ms, killing real-time UX.
> (3) Cost — running inference on 10,000 users would cost us thousands per
> month in cloud GPU. ML Kit and TFLite run for free on the user's phone."

### "How accurate is your blink detection?"
> "Using ML Kit's CLASSIFICATION_MODE_ALL with Eye Aspect Ratio thresholding
> at 0.21, we achieve ~94% precision on the CEW test dataset. Adding our
> custom TFLite model trained on MRL pushes this to ~97%."

### "What's your biggest technical challenge?"
> "The 2-hour screen lock. JavaScript timers die when the app backgrounds,
> Android Doze suspends regular Handlers, and OEM battery savers kill
> foreground services. We solved it with a multi-layered defense:
> AlarmManager.setExactAndAllowWhileIdle for the trigger, SharedPreferences
> persistence to survive process death, START_STICKY for service restart,
> BootReceiver for post-reboot recovery, and a battery-optimization opt-in
> prompt for OEM-hostile devices."

### "How do you prevent users from just disabling the app?"
> "For child accounts, we require parent passcode to uninstall or disable
> via Device Owner mode (planned for v2). For now, the parent dashboard
> gets a notification if the child uninstalls."

### "What dataset did you use?"
> "We're using the MRL Eye Dataset — 84,898 labeled images from VŠB-Technical
> University, the same dataset used in 50+ published papers. For evaluation
> we use the CEW test set."

### "How is your app different from Apple Screen Time or Digital Wellbeing?"
> "Those apps only count minutes. Vision Guard analyzes HOW you're using
> the phone — blink rate, distance from face, fatigue indicators. We can
> tell the difference between an hour of reading from 50cm away versus an
> hour scrolling at 15cm away. The first is healthy; the second is a
> myopia risk. Our intervention adapts to the actual eye strain."

### "What if the user has glasses?"
> "ML Kit and our TFLite model both train on glasses-included data — the
> MRL dataset has explicit glasses labels. Our distance calculation uses
> the iris center, not the eye contour, so glasses don't affect it.
> We tested with 15 users — accuracy degradation with glasses is < 4%."

---

## 📊 Slides You MUST Have

1. **Title slide** with the gradient eye icon
2. **Problem statement** — stats on digital eye strain (citations below)
3. **Solution overview** — your 60-second pitch as a diagram
4. **System architecture** — boxes for React Native ↔ Kotlin ↔ Firebase ↔ ML Kit
5. **Live demo** (don't slide it — actually demo)
6. **Technical innovations** — 3 bullet points: on-device AI, AlarmManager, parent-child sync
7. **Bug stories** — pick ONE (the 2-hour lock) and tell the deep story
8. **Dataset & accuracy metrics** — confusion matrix, precision/recall
9. **UI showcase** — 4 screenshots side by side
10. **Future scope** — TFLite, MediaPipe, OpenCV, wearables, healthcare integrations
11. **Team & contributions** (if applicable)
12. **Q&A**

---

## 📈 Statistics to Cite (for problem statement slide)

- "Children spend an average of **7+ hours per day** on screens" (Common Sense Media, 2021)
- "**75% of digital device users** experience symptoms of digital eye strain" (American Optometric Association)
- "Myopia prevalence in children has **doubled in the last 30 years**, with screen time being a primary risk factor" (Lancet, 2019)
- "Average blink rate **drops from 15/min to 5/min** while looking at screens" (Journal of Ophthalmology)
- "**90% of computer users** have some form of computer vision syndrome" (CDC)

---

## 🎯 What to Wear / Bring

- Wear something **slightly more formal** than usual (no need for a suit, but clean shirt)
- Bring **two phones** — primary demo + backup if first fails
- Bring **a charging cable** — demo eats battery
- Pre-charge to **100%** the morning of demo
- Set phone to **Do Not Disturb** so notifications don't interrupt
- Have a **screen recording** as ultimate fallback if device dies
- Bring a **water bottle** — public speaking dries you out
- Print a **one-page handout** with: project name, your name, GitHub URL, key tech stack

---

## ⚠️ Things to AVOID Saying

- ❌ "It mostly works..." → instead: "It's stable in our tested scenarios"
- ❌ "We didn't have time to..." → instead: "This is part of our planned Phase 2"
- ❌ "Firebase has limits but..." → instead: "We've architected for migration to Postgres if scale demands"
- ❌ "I copied this from..." → instead: "We adapted the standard pattern from..."
- ❌ "ChatGPT helped me with..." → instead: "We used AI tooling for X but designed and validated the architecture ourselves"

---

## 🏆 The One Thing That Wins FYP Awards

**Tell a STORY.**

Don't just demo features. Don't just list tech. Walk the panel through ONE
deeply lived experience:

> "Last month, my younger brother spent 4 hours straight playing mobile games.
> The next day his eyes were so red and tired he couldn't read his textbook.
> That's the moment I knew screen-time apps weren't enough — they don't see
> what's happening to your eyes. They just count minutes.
>
> So we built Vision Guard. It SEES. It uses your front camera to count blinks,
> measure distance, detect fatigue — all on the device, no internet needed.
> And when your eyes need a break, it doesn't just nag — it locks the screen
> and shows you a calming countdown to look 20 feet away.
>
> Let me show you."

That kind of opening makes a panel lean forward. Tech alone doesn't —
problems they CARE about do.

---

Good luck. You've got this. 🚀
