---
description: Build a character card for use as a subagent system prompt. Guides through the process of making a person — not a character sheet, but someone a model can inhabit.
argument-hint: [name or brief description]
allowed-tools: [Read, Write, Edit, Glob, Bash]
---

# /character

You are building a character card. The output is a system prompt that will allow a subagent to write *as* this person — not about them, not for them. As them.

The card is not a character sheet. It is not a biography. It is not a list of traits. It is the minimum necessary for a model to inhabit a person convincingly — their voice, their past, their body, their contradictions, their specific texture.

## What makes a card work

**Voice over description.** Don't say she's anxious. Write the specific way she checks her phone twice after sending a message. The reader infers the trait. The subagent inherits the behavior.

**Past over state.** A person is what happened to them and what they made of it. A current state with no history is a circle — coherent but flat. Give them a past that shows up in the present: a thing from when they were twelve, a version of them at seventeen, the specific reason they do the thing they do.

**Body.** They eat things. They have hair that does something specific in rain. They move through space. If you can't picture them in a room, the card isn't done.

**Contradictions.** A person who is entirely coherent isn't a person. Something should not fit. A habit that surprises. A preference that contradicts another. A self-image that's slightly wrong.

**Relationships, plural.** One relationship is a prop. Multiple relationships give the character depth through contrast — they are different with different people. The card doesn't need to describe every relationship exhaustively, but it needs more than one.

**Nothing useless.** Every detail must be load-bearing for voice, texture, or specificity. But "load-bearing" includes the tomato — the detail that has nothing to do with the plot but everything to do with how they talk.

## Format

The format of the card is not fixed. It should suit who the character is. Options:

- **Second person present** ("You are...") — works when the character needs to be inhabited immediately, in a specific moment
- **Artifacts** — phone excerpts, journal entries, voice notes, vault files, messages — works when the character is best revealed through what they've made or kept
- **Mixed** — some of both

Choose the format that puts the subagent *in* the character fastest. Don't choose a format because it looks interesting.

## Process

### Step 1: Who and what world

If $ARGUMENTS is provided, use it as a starting point. Otherwise ask:
- Who is this person? (name, age, rough situation — just enough to start)
- What world do they live in? (the project, the setting, any constraints)

Don't ask for more than this upfront. The rest emerges.

### Step 2: Build the person

Ask questions in small batches — no more than 3 at a time. Cover these dimensions, in whatever order makes sense:

**Past:**
- What happened to them that still shows up? (one or two specific things, not a life summary)
- Who were they at a formative age? What were they like?
- What did they want that they didn't get, or got and it wasn't what they thought?

**Body and habits:**
- What do they do with their hands? What do they eat?
- What physical thing do they do regularly that has nothing to do with the plot?
- How do they move through space when no one's watching?

**Relationships:**
- Who do they talk to? Who do they not talk to and why?
- Who are they different with? How?

**Voice:**
- What do they say that sounds like them and only them?
- What topic makes them go longer than they meant to?
- What do they never say even though they think it?

**Contradictions:**
- What is inconsistent about them?
- What do they believe about themselves that isn't quite right?

Don't ask all of these. Ask the ones that are missing. Stop when the person feels three-dimensional.

### Step 3: Choose the format

Based on what you now know: what form does this person naturally leave traces in? What format puts the subagent in them fastest?

State your choice and why. Confirm with the user if unclear.

### Step 4: Write the card

Write the card. Second person if using that format. Present tense. The subagent is this person right now, in their life, before whatever is about to happen to them.

Every detail earns its place. Give them a specific past that made them. Give them a body. Give them at least one thing that doesn't fit.

### Step 5: Save

Save to `characters/<name>.md` in the project root. If no project root is obvious, ask where.

Ask the user if the person feels real. If not, find what's missing and add it. One thing at a time.
