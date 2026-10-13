# Markdown exam format

Each generated file is one exam. The page title comes from the HTML `<title>`, with a trailing ` - Nihonez` removed. Furigana, underlines, tables, and referenced images are converted into portable markdown.

## Headings

| Level | Source | Example |
| --- | --- | --- |
| `#` | Page title | `# JLPT N4 Mock Test – December 2024` |
| `##` | Section title | `## 聴解` |
| `###` | Sidebar subsection title | `### もんだい1: Task-based Comprehension` |
| `####` | Question number | `#### Question 1` |

The subsection instruction, originally an `h3` in the results page, is a blockquote under the `###` heading.

## Passages and questions

A reading group is written in this order:

1. The passage, including ruby, tables, and screenshots.
2. **Passage translation**, when the page includes one.
3. Each question under that passage.

Text-grammar items often have an empty question stem. The blank markers such as `[18]` stay in the passage, and the numbered choices follow as their own question.

A question then contains:

- The stem, when it has text.
- Embedded images as `![alt](media/<file>)`.
- Choices as a numbered list. The correct choice is bold.
- A `**Correct answer:**` line repeating that choice.
- **Transcript**, only when the question has listening-script text.
- **Explanation**, split into the labeled blocks from the page when those labels are present.

Explanation labels that start their own block include `Correct Answer`, `Question Translation`, `Explanation`, `Why Other Options Are Incorrect`, `Grammar/Vocabulary Note`, `Answer (★ Position)`, `Correct Order`, and `Test-Taking Tip`. Other bold words, such as a vocabulary item inside a sentence, stay inline bold.

## Inline text

- `<ruby>漢<rt>かん</rt></ruby>` becomes `漢（かん）` in stems, choices, passages, and transcripts.
- Underlined target words become `<u>...</u>`.
- A table becomes a markdown table.
- A double line break becomes a paragraph break.
- Fullwidth spaces in the exam text are kept.

## Left out

The markdown does not include the captured score (`Points: 0 / 1`), the notes UI, or audio files. Listening audio stays on the source page; the exam keeps the transcript text only.
