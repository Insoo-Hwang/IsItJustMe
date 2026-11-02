package com.isitjustme.room;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import com.isitjustme.category.CategoryService;
import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.category.CombinationStatsRepository;
import com.isitjustme.category.OverallAnswerRepository;
import com.isitjustme.guest.AgeGroup;
import com.isitjustme.guest.Gender;
import com.isitjustme.guest.GuestProfile;
import com.isitjustme.guest.GuestService;
import com.isitjustme.room.RoomService.ComparisonView;
import com.isitjustme.room.RoomService.PlanetView;
import com.isitjustme.room.RoomService.Role;
import com.isitjustme.room.RoomService.RoomView;
import com.isitjustme.room.RoomService.UniverseView;

@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({ RoomService.class, RoomCards.class, CategoryService.class, CategoryStatsCache.class,
		CombinationStatsRepository.class, OverallAnswerRepository.class, GuestService.class })
class RoomServiceTests {

	@Container
	@ServiceConnection
	static PostgreSQLContainer postgres = new PostgreSQLContainer(DockerImageName.parse("postgres:18"));

	private static final List<String> CATEGORY_CODES = List.of("food", "love", "life", "travel", "spending", "people");

	@Autowired
	private RoomService roomService;

	@Autowired
	private CategoryService categoryService;

	@Autowired
	private GuestService guestService;

	@Test
	void sharingAgainKeepsTheRoomAndUpdatesTheName() {
		String owner = finishedGuest(0);

		String shareToken = roomService.open(owner, "철수");

		assertThat(roomService.open(owner, " 철수2 ")).isEqualTo(shareToken);
		assertThat(roomService.room(null, shareToken).ownerName()).isEqualTo("철수2");
	}

	@Test
	void onlyGuestsWhoFinishedEveryCategoryCanShare() {
		String unfinished = guest();
		categoryService.submit(unfinished, "food", 0);

		assertThatThrownBy(() -> roomService.open(unfinished, "철수")).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("409");
		assertThatThrownBy(() -> roomService.open(finishedGuest(0), "  ")).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("400");
	}

	@Test
	void roomShowsOwnerAndViewerRole() {
		String owner = finishedGuest(0b1);
		String shareToken = roomService.open(owner, "철수");
		String member = finishedGuest(0);
		long planetId = roomService.join(member, shareToken, "영희");

		RoomView asVisitor = roomService.room(null, shareToken);
		assertThat(asVisitor.ownerName()).isEqualTo("철수");
		assertThat(asVisitor.owner()).extracting(CategoryBits::code).containsExactlyElementsOf(CATEGORY_CODES);
		assertThat(asVisitor.owner()).extracting(CategoryBits::answerBits).containsOnly(0b1);
		assertThat(asVisitor.planets()).isEqualTo(1);
		assertThat(asVisitor.viewer().role()).isEqualTo(Role.VISITOR);
		assertThat(asVisitor.viewer().complete()).isFalse();

		assertThat(roomService.room(owner, shareToken).viewer().role()).isEqualTo(Role.OWNER);
		RoomView asMember = roomService.room(member, shareToken);
		assertThat(asMember.viewer().role()).isEqualTo(Role.MEMBER);
		assertThat(asMember.viewer().complete()).isTrue();
		assertThat(asMember.viewer().planetId()).isEqualTo(planetId);
	}

	@Test
	void universeShowsEachPlanetsMatchWithTheOwner() {
		String shareToken = roomService.open(finishedGuest(0), "철수");
		String same = finishedGuest(0);
		String apart = finishedGuest(0b11_1111_1111);
		roomService.join(same, shareToken, "  영희 ");
		roomService.join(apart, shareToken, "민수");

		UniverseView universe = roomService.universe(same, shareToken);

		assertThat(universe.planets()).extracting(PlanetView::name).containsExactly("영희", "민수");
		assertThat(universe.planets()).extracting(PlanetView::match).containsExactly(100, 0);
		assertThat(universe.planets()).extracting(PlanetView::me).containsExactly(true, false);
	}

	@Test
	void joiningAgainKeepsTheFirstPlanet() {
		String shareToken = roomService.open(finishedGuest(0), "철수");
		String member = finishedGuest(0);

		long first = roomService.join(member, shareToken, "영희");

		assertThat(roomService.join(member, shareToken, "다른 이름")).isEqualTo(first);
		assertThat(roomService.universe(null, shareToken).planets()).extracting(PlanetView::name).containsExactly("영희");
	}

	@Test
	void rejectsInvalidJoins() {
		String owner = finishedGuest(0);
		String shareToken = roomService.open(owner, "철수");
		String unfinished = guest();
		categoryService.submit(unfinished, "food", 0);

		assertThatThrownBy(() -> roomService.join(owner, shareToken, "나")).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("400");
		assertThatThrownBy(() -> roomService.join(finishedGuest(0), shareToken, "   "))
			.isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("400");
		assertThatThrownBy(() -> roomService.join(finishedGuest(0), shareToken, "열한글자짜리이름입니다"))
			.isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("400");
		assertThatThrownBy(() -> roomService.join(unfinished, shareToken, "지수"))
			.isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("409");
		assertThatThrownBy(() -> roomService.join(finishedGuest(0), "unknown", "지수"))
			.isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("404");
	}

	@Test
	void comparesTheOwnerWithTheViewerOnly() {
		String owner = finishedGuest(0);
		String shareToken = roomService.open(owner, "철수");
		String member = finishedGuest(0b111);
		long planetId = roomService.join(member, shareToken, "영희");
		String visitor = finishedGuest(0);

		ComparisonView asMember = roomService.compare(member, shareToken);
		assertThat(asMember.ownerName()).isEqualTo("철수");
		assertThat(asMember.planetId()).isEqualTo(planetId);
		assertThat(asMember.planetName()).isEqualTo("영희");
		assertThat(asMember.match()).isEqualTo(70);
		assertThat(asMember.categories()).hasSize(6).allSatisfy((c) -> assertThat(c.matched()).isEqualTo(7));

		ComparisonView asVisitor = roomService.compare(visitor, shareToken);
		assertThat(asVisitor.planetId()).isNull();
		assertThat(asVisitor.match()).isEqualTo(100);

		assertThatThrownBy(() -> roomService.compare(owner, shareToken)).isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("400");
		String unfinished = guest();
		categoryService.submit(unfinished, "food", 0);
		assertThatThrownBy(() -> roomService.compare(unfinished, shareToken))
			.isInstanceOf(ResponseStatusException.class)
			.hasMessageContaining("409");
	}

	private String guest() {
		String token = guestService.resolveOrIssue(null).token();
		guestService.updateProfile(token, new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES));
		return token;
	}

	private String finishedGuest(int answerBits) {
		String token = guest();
		CATEGORY_CODES.forEach((code) -> categoryService.submit(token, code, answerBits));
		return token;
	}

}
