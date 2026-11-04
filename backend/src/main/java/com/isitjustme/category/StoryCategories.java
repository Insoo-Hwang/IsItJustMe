package com.isitjustme.category;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Categories and questions as written in STORY.md, chapter 5, in document order.
 * {@link #parse} checks the format and the column lengths, and its errors name the line
 * to fix.
 */
record StoryCategories(List<Entry> categories) {

	static final String CHAPTER = "## 5. 카테고리와 문항";

	private static final List<String> CATEGORY_COLUMNS = List.of("코드", "이름", "아이콘", "한 줄 소개", "설명", "시간(분)",
			"추천 대상");

	private static final List<String> QUESTION_COLUMNS = List.of("#", "질문", "A", "B");

	private static final Pattern CODE = Pattern.compile("`([a-z]+)`");

	private static final Pattern SUBSECTION = Pattern.compile("### `([a-z]+)`.*");

	static StoryCategories parse(String markdown) {
		List<String> lines = markdown.lines().toList();
		int start = lines.indexOf(CHAPTER);
		if (start < 0) {
			throw new StoryException("\"" + CHAPTER + "\" 제목이 없어요");
		}
		int end = start + 1;
		while (end < lines.size() && !lines.get(end).startsWith("## ") && !lines.get(end).startsWith("# ")) {
			end++;
		}

		// the category table, then one "### `code`" subsection with a question table each
		List<Row> categoryRows = null;
		Map<String, List<Row>> questionRows = new LinkedHashMap<>();
		String subsection = null;
		int subsectionLine = 0;
		List<Integer> tableLines = new ArrayList<>();
		for (int i = start + 1; i <= end; i++) {
			String line = (i < end) ? lines.get(i).trim() : "";
			if (line.startsWith("|")) {
				tableLines.add(i);
				continue;
			}
			if (!tableLines.isEmpty()) {
				List<Row> rows = table(lines, tableLines, (subsection == null) ? CATEGORY_COLUMNS : QUESTION_COLUMNS);
				tableLines.clear();
				if (subsection == null) {
					categoryRows = rows;
				}
				else if (questionRows.putIfAbsent(subsection, rows) != null) {
					throw new StoryException(subsectionLine, "`" + subsection + "` 문항 표가 두 번 있어요");
				}
			}
			if (line.startsWith("### ")) {
				Matcher matcher = SUBSECTION.matcher(line);
				if (!matcher.matches()) {
					throw new StoryException(i + 1, "\"### `코드` 이름\" 형식이어야 해요");
				}
				subsection = matcher.group(1);
				subsectionLine = i + 1;
			}
		}
		if (categoryRows == null) {
			throw new StoryException(start + 1, "카테고리 표가 없어요");
		}

		List<Entry> categories = new ArrayList<>();
		for (Row row : categoryRows) {
			String code = code(row.cells().get(0), row.line());
			List<Row> questions = questionRows.remove(code);
			if (questions == null) {
				throw new StoryException(row.line(), "`" + code + "`의 문항 표(### `" + code + "`)가 없어요");
			}
			categories.add(entry(code, row, questions));
		}
		if (!questionRows.isEmpty()) {
			throw new StoryException(start + 1, "카테고리 표에 없는 문항 표가 있어요: " + questionRows.keySet());
		}
		return new StoryCategories(List.copyOf(categories));
	}

	private static Entry entry(String code, Row row, List<Row> questionRows) {
		List<String> cells = row.cells();
		int minutes;
		try {
			minutes = Integer.parseInt(cells.get(5));
		}
		catch (NumberFormatException ex) {
			throw new StoryException(row.line(), "시간(분)은 숫자여야 해요");
		}
		if (minutes < 1) {
			throw new StoryException(row.line(), "시간(분)은 1 이상이어야 해요");
		}
		List<String> recommend = Arrays.stream(cells.get(6).split(" · ")).map(String::trim).toList();
		recommend.forEach((r) -> checkLength(r, 100, row.line(), "추천 대상"));
		if (questionRows.size() != RarityCalculator.QUESTION_COUNT) {
			throw new StoryException(row.line(), "`" + code + "` 문항은 " + RarityCalculator.QUESTION_COUNT + "개여야 해요");
		}
		List<QuestionText> questions = new ArrayList<>();
		for (int i = 0; i < questionRows.size(); i++) {
			Row q = questionRows.get(i);
			if (!q.cells().get(0).equals(String.valueOf(i + 1))) {
				throw new StoryException(q.line(), "문항 번호는 1부터 차례로 써야 해요");
			}
			questions.add(new QuestionText(checkLength(q.cells().get(1), 200, q.line(), "질문"),
					checkLength(q.cells().get(2), 100, q.line(), "A"), checkLength(q.cells().get(3), 100, q.line(), "B")));
		}
		return new Entry(code, checkLength(cells.get(1), 100, row.line(), "이름"),
				checkLength(cells.get(2), 50, row.line(), "아이콘"), checkLength(cells.get(3), 200, row.line(), "한 줄 소개"),
				checkLength(cells.get(4), 200, row.line(), "설명"), minutes, recommend, List.copyOf(questions));
	}

	// Rows under the header and separator; the header must match the expected columns.
	private static List<Row> table(List<String> lines, List<Integer> at, List<String> columns) {
		List<Row> rows = at.stream().map((i) -> new Row(i + 1, cells(lines.get(i)))).toList();
		if (!rows.getFirst().cells().equals(columns)) {
			throw new StoryException(rows.getFirst().line(), "표의 열은 " + String.join(" | ", columns) + "이어야 해요");
		}
		List<Row> body = rows.subList(Math.min(2, rows.size()), rows.size());
		for (Row row : body) {
			if (row.cells().size() != columns.size()) {
				throw new StoryException(row.line(), "칸이 " + columns.size() + "개여야 해요");
			}
			if (row.cells().stream().anyMatch(String::isEmpty)) {
				throw new StoryException(row.line(), "빈 칸이 있어요");
			}
		}
		return body;
	}

	private static List<String> cells(String line) {
		String inner = line.trim().replaceAll("^\\||\\|$", "");
		return Arrays.stream(inner.split("\\|", -1)).map(String::trim).toList();
	}

	private static String code(String cell, int line) {
		Matcher matcher = CODE.matcher(cell);
		if (!matcher.matches()) {
			throw new StoryException(line, cell + ": `코드` 형식이어야 해요");
		}
		return matcher.group(1);
	}

	private static String checkLength(String value, int max, int line, String column) {
		if (value.length() > max) {
			throw new StoryException(line, column + "은 " + max + "자 이하여야 해요");
		}
		return value;
	}

	private record Row(int line, List<String> cells) {
	}

	/**
	 * @param questions in bit order (question n is bit n - 1)
	 */
	record Entry(String code, String name, String icon, String tagline, String description, int minutes,
			List<String> recommend, List<QuestionText> questions) {
	}

	record QuestionText(String prompt, String option0, String option1) {
	}

	static class StoryException extends IllegalStateException {

		StoryException(int line, String message) {
			super("STORY.md:" + line + ": " + message);
		}

		StoryException(String message) {
			super("STORY.md: " + message);
		}

	}

}
