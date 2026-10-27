# Question Explainer

Type any question and get a short, animated, step-by-step explanation in simple words. At the end, answer a check question to see if it landed. The app never shows the answer in the question.

## Why this exists

- Most explanations are written for people who already half-understand the topic. This one is written for a complete beginner, including someone reading in a second language.
- A wall of text is easy to skim and forget. A small pixel-art story, shown one step at a time, is easier to follow and remember.
- Explaining is different from answering. The app teaches with a real-life example first, then connects it to the real topic. Then it asks the learner to work out the answer.
- It is built to work for any kind of question: general knowledge, word problems, school math, advanced math, one-word inputs ("7 squares"), and unclear questions.
- Languages: English, Japanese and Burmese.

## Tech stack

| Part | Tools |
| --- | --- |
| Front end | React 19, TypeScript, Vite, Framer Motion |
| Pictures | 16x16 pixel-art sprites drawn as SVG, in one shared colour palette |
| Back end | Hono (Node), Zod for data shapes |
| AI | OpenAI (`gpt-6-luna`, falls back to `gpt-5.6-luna` if the project has no access) |
| Math checking | mathjs, with exact fractions |
| Hosting | Vercel (static site plus serverless functions in `api/`) |
| Tests | Vitest |

## How an explanation is made

1. **Ask.** The learner picks a language and types a question on a single-input screen.
2. **Plan.** The AI does not write the final lesson. It writes a *lesson plan*: the steps, the pictures, the arrows between them, and the check question. If the question is vague, it returns clickable choices instead.
3. **Verify.** Code checks the plan before anything is shown.
   - It computes the correct answer itself and keeps it hidden on the server.
   - Numbers in the pictures must come from the question or its working, never from the answer.
   - Pictures must be real objects with clear labels, arrows must be simple and connected, and words like "many" or "stuff" are rejected.
   - The check question must not contain its own answer.
4. **Retry.** If a check fails, the problems are sent back to the AI for a fix. After the third try, a lesson with minor style problems is shown rather than nothing.
5. **Sprites.** Each object is looked up in the built-in sprite library, then in saved drawings. If it is missing, the AI draws a new 16x16 sprite, which is validated and saved for next time. As a last resort a labelled placeholder is shown.
6. **Build the steps.** Code turns the plan into animated steps: what appears, in which order, where it sits, and how the arrows run.
7. **Seal the answer.** The hidden answer is encrypted into a token that travels with the lesson. The server stores nothing.
8. **Play.** The board shows the text on top and the animation below. The picture appears first, then an arrow draws to the next picture, one after another. Controls are small and at the bottom, and all steps play on their own.
9. **Answer.** The learner answers a typed, multiple-choice or written question. Math is checked by code, multiple choice by the sealed token, and written answers by an AI grader.
10. **Hints.** A wrong answer gets a hint that points at the missing idea, one more hint with each try. The correct answer is never revealed.

## Run it

```bash
npm install
cp .env.example .env     # add your OPENAI_API_KEY and a LESSON_SECRET
npm run dev              # web on :3000, API on :8787
npm test
npm run build            # also bundles the API for Vercel into api/_app.js
```

On Vercel, set `OPENAI_API_KEY` and `LESSON_SECRET` as environment variables.

## Test budget

The whole site shares one token budget (`TOKEN_BUDGET`, default 500,000 on Vercel, no limit locally). When it is used up, new questions get a polite "test limit reached" message. To make the count exact across Vercel's servers, connect an Upstash Redis from Vercel Storage (it sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Without it, each server copy counts on its own and resets when it restarts.

## Cost

A typical lesson costs a few tenths of a cent to about a cent, depending on retries and new sprites. Each question's cost is printed in the terminal.
