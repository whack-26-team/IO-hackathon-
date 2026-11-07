# REMY demo script (about 3 minutes)

Owner: Matthew. Part of #11. **Draft:** written before the first real-Remy test, so
re-check every "Remy says" line after that test and change anything he doesn't do.

**The story in one line:** prop up your phone, cook, and REMY watches, starts timers
by itself, stops you hurting yourself, and roasts you when you deserve it.

**No hob anywhere.** Every beat uses cold food or water from a flask, so it's safe
in a judging room and works on any table.

---

## Who does what

| Person | Job on the day |
|---|---|
| **Talker** | Faces the judges, does the intro, narrates each beat and the close |
| **Cook** | Stands at the table, does the actions, speaks to Remy |
| **Phone** | Sets up the phone on its stand, mirrors it to the big screen, taps Start / Stop / Savage |
| **Backup** | Has the backup video ready on a laptop, watches the time, calls "go to backup" |

## Props checklist

- [ ] iPhone with REMY on the home screen, charged, **Do Not Disturb on**, volume up
- [ ] Phone stand or tripod, angled down at the table
- [ ] Cable or AirPlay to mirror the phone on the big screen (test it in the room)
- [ ] Phone hotspot as backup Wi-Fi
- [ ] Flask of just-boiled water (no kettle in the room), heatproof bowl, plate to cover it
- [ ] 1 packet of instant noodles, fork
- [ ] Chopping board, damp cloth under it, small knife, 1 banana
- [ ] Bowl, spoon, cereal, small jug of milk
- [ ] Kitchen roll for spills
- [ ] Laptop with the backup video (#12) open and paused on frame 1

## Before you go on (5 minutes before)

1. Open https://remy-2wc2.onrender.com once, to wake the free server (the first load can take about 50 seconds).
2. Open REMY from the home screen and check the camera and mic permissions still work.
3. **Untick Pretend Remy.** Choose **Honest**. Don't press Start yet.
4. Point the phone at the board and bowl. Check the big screen shows it.

---

## The run

### 0:00 · Intro (Talker, 20 s)
> "Cooking from a recipe means wet hands on a phone, burnt garlic and guessing the
> timers. This is REMY: you prop up your phone, and a chef watches you cook, talks to
> you, and starts the timers by himself. With a bit of an attitude."

**Phone** taps **Start cooking**.
- **Remy says** a greeting and asks what you're making.
- **On screen:** the camera, Remy's face, and "Tell Remy what you're cooking 🎤".

**Cook:** "Remy?" → **Remy:** "Yes, chef?" (he always answers to his name).

### 0:20 · Beat 1, automatic timer: instant noodles (40 s)
**Cook:** "Remy, I'm making instant noodles."
- **On screen:** the "✓ Checked recipe" card with the steps.

**Cook** puts the noodles in the bowl, pours water from the flask and says: **"Noodles are in."**
(Say the food's name, e.g. "noodles are in" or "pasta's in": that's what starts the timer.)
- The **3-minute Noodles timer starts by itself** the moment he hears it. A paper ticket drops
  from the rail, the bubble says "⏱ 3-minute timer for the noodles", and Remy says it out loud.

**Talker:**
> "Nobody touched the screen. The times come from our own cooking-times table, not
> AI guesses, and he tells you what he started so you can change it."

**Cook** covers the bowl with the plate.

### 1:00 · Beat 2, safety: slicing a banana (40 s)
**Cook:** "While that's going, I'm slicing a banana for the top."

Cook starts slicing **slowly, with fingertips flat in front of the knife.** Keep it
slow and exaggerated: this is staged, never fast.
- **Remy** shows the **red safety alert**: "Fingers! Tuck them into a claw." No jokes.

**Cook** switches to a claw grip.
- **Remy** praises the fix.

**Talker:**
> "Safety always beats comedy. When something's dangerous he drops the act. He only
> roasts you once you're safe."

### 1:40 · Beat 3, timer done (20 s)
**Phone** taps **−1** on the Noodles ticket twice, to fast-forward for the demo.

**Talker:** "We'll skip the wait."
- The ticket turns yellow, then red.
- **Remy** says the noodles are done and to take the plate off carefully, because of the steam.

### 2:00 · Beat 4, personality: Savage cereal (45 s)
**Phone** taps **Stop**, picks **🤬 Savage**, confirms 18+, then taps **Start cooking**.

**Talker:**
> "He has three attitudes. Gentle for beginners, Honest by default, and this one,
> which is opt-in and 18+."

**Cook:** "Remy, bowl of cereal." The cook then pours the **milk in first**, then the cereal.
- **Remy** gives a Savage roast (it may swear: Savage is 18+).

**Cook** fires back: **"Remy, you're rubbish."**
- **Remy** insults straight back, e.g. "Big words from someone who just turned garlic into charcoal."

**Talker:**
> "Ignore him and it escalates. Insult him and he bites back."

### 2:45 · Close (Talker, 15 s)
> "Live voice, live eyes, timers from real cooking data, and food-safety facts that
> never come from AI guesses. REMY: a chef in your pocket who actually watches."

**Phone** taps **Stop**.
- The **goodbye screen**: Remy signs off out loud in his attitude (Savage: "Bloody hell, we
  survived. Plate it and get out of my kitchen."), then the app returns to the start screen by itself.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| Remy doesn't answer within 5 s | Cook repeats the line, closer to the phone |
| Remy still silent / "error" chip | **Phone:** Stop, tick **Pretend Remy**, Start (or open `?demo=1` demo mode, #83, once it's built). **Talker** narrates. |
| No timer after "noodles are in" | Cook: "Remy, start a 3-minute noodle timer." |
| ElevenLabs down / out of credits | Nothing to do: Remy **switches to his backup voice by itself** (the phone's voice, with Gemini writing his lines) and says so on screen. To skip ElevenLabs entirely, open `https://remy-2wc2.onrender.com/?backup=1`. |
| No safety alert on the knife | Cook: "Remy, how's my knife grip?" Never speed up the knife to force it. |
| Wi-Fi drops | Switch the phone to the hotspot, Stop, Start |
| Anything worse | **Backup:** "Let's show you the recording", and play the video (#12) |

## Rehearsal checklist
- [ ] Run it 3 times start to finish with a timer. Target: under 3:15.
- [ ] Once with `?backup=1` (the backup voice) and once on Pretend Remy only.
- [ ] Once with the room's big screen, if you can get access.
- [ ] Write what Remy actually said in each beat under this line, then update the script.
