package com.isitjustme.category;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.isitjustme.category.StoryCategories.Entry;
import com.isitjustme.category.StoryCategories.QuestionText;
import com.isitjustme.category.StoryCategories.StoryException;
import com.isitjustme.config.CacheConfig;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

/**
 * Copies the category and question texts from STORY.md into the database on startup. A
 * broken document stops the startup. When the file itself is next to the server (local
 * runs), later saves are applied too, and a broken save only logs. Elsewhere the copy
 * packaged into the jar is read once.
 */
@Slf4j
@Component
public class StorySync implements ApplicationRunner {

	private static final long WATCH_MILLIS = 1000;

	private final CategoryRepository categoryRepository;

	private final QuestionRepository questionRepository;

	private final CacheManager cacheManager;

	private final TransactionTemplate transactions;

	private final Path file;

	private final ScheduledExecutorService watcher = Executors.newSingleThreadScheduledExecutor((task) -> {
		Thread thread = new Thread(task, "story-watch");
		thread.setDaemon(true);
		return thread;
	});

	StorySync(CategoryRepository categoryRepository, QuestionRepository questionRepository, CacheManager cacheManager,
			TransactionTemplate transactions, @Value("${story.file}") String file) {
		this.categoryRepository = categoryRepository;
		this.questionRepository = questionRepository;
		this.cacheManager = cacheManager;
		this.transactions = transactions;
		// a plain file path; Spring's Path conversion would read it as a web resource
		this.file = Path.of(file);
	}

	@Override
	public void run(ApplicationArguments args) throws IOException {
		if (Files.isRegularFile(file)) {
			apply(Files.readString(file));
			watch();
			return;
		}
		ClassPathResource packaged = new ClassPathResource("STORY.md");
		if (!packaged.exists()) {
			log.warn("STORY.md not found at {} or on the classpath; categories stay as they are", file.toAbsolutePath());
			return;
		}
		try (InputStream in = packaged.getInputStream()) {
			apply(new String(in.readAllBytes(), StandardCharsets.UTF_8));
		}
	}

	/**
	 * Updates the texts of the existing categories and questions. Categories cannot be
	 * added, removed or reordered: answers are stored as bits in category and question order.
	 * @return whether anything changed
	 */
	public boolean apply(String markdown) {
		List<Entry> story = StoryCategories.parse(markdown).categories();
		Integer changed = transactions.execute((status) -> {
			List<Category> categories = categoryRepository.findAllByOrderBySortOrder();
			List<String> codes = categories.stream().map(Category::getCode).toList();
			if (!codes.equals(story.stream().map(Entry::code).toList())) {
				throw new StoryException("카테고리는 " + String.join(", ", codes) + " 순서 그대로여야 해요 (추가 · 삭제 · 순서 변경 불가)");
			}
			Map<Long, List<Question>> questions = questionRepository
				.findByCategoryIdInOrderByBitPosition(categories.stream().map(Category::getId).toList())
				.stream()
				.collect(Collectors.groupingBy(Question::getCategoryId));
			int count = 0;
			for (int i = 0; i < categories.size(); i++) {
				Category category = categories.get(i);
				Entry entry = story.get(i);
				if (category.updateTexts(entry.name(), entry.icon(), entry.description(), entry.tagline(),
						entry.minutes(), entry.recommend())) {
					count++;
				}
				List<Question> current = questions.getOrDefault(category.getId(), List.of());
				for (Question question : current) {
					QuestionText text = entry.questions().get(question.getBitPosition());
					if (question.updateTexts(text.prompt(), text.option0(), text.option1())) {
						count++;
					}
				}
			}
			return count;
		});
		if (changed == null || changed == 0) {
			return false;
		}
		log.info("STORY.md: updated {} categories and questions", changed);
		clearCatalog();
		return true;
	}

	private void clearCatalog() {
		Cache cache = cacheManager.getCache(CacheConfig.CATEGORIES);
		try {
			if (cache != null) {
				cache.invalidate();
			}
		}
		catch (RuntimeException ex) {
			// the catalog never expires, so this stays stale until it is cleared by hand
			log.warn("Could not clear the {} cache after STORY.md changed", CacheConfig.CATEGORIES, ex);
		}
	}

	private void watch() throws IOException {
		FileTime[] seen = { Files.getLastModifiedTime(file) };
		watcher.scheduleWithFixedDelay(() -> {
			try {
				FileTime modified = Files.getLastModifiedTime(file);
				if (modified.equals(seen[0])) {
					return;
				}
				seen[0] = modified;
				apply(Files.readString(file));
			}
			catch (IOException | RuntimeException ex) {
				log.error("STORY.md not applied; keeping the previous texts: {}", ex.getMessage());
			}
		}, WATCH_MILLIS, WATCH_MILLIS, TimeUnit.MILLISECONDS);
		log.info("Watching {} for category changes", file.toAbsolutePath());
	}

	@PreDestroy
	void stop() {
		watcher.shutdownNow();
	}

}
