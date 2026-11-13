package com.isitjustme.room;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.isitjustme.category.CategoryService.CategoryBits;
import com.isitjustme.room.RoomService.ComparisonView;
import com.isitjustme.room.RoomService.PlanetDetailView;
import com.isitjustme.room.RoomService.PlanetView;
import com.isitjustme.room.RoomService.Role;
import com.isitjustme.room.RoomService.RoomView;
import com.isitjustme.room.RoomService.UniverseView;
import com.isitjustme.room.RoomService.ViewerView;
import com.isitjustme.room.TasteMatch.CategoryMatch;

@WebMvcTest(RoomController.class)
class RoomControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private RoomService roomService;

	@Test
	void opensRoom() throws Exception {
		given(roomService.open("token", "철수")).willReturn("share");

		mockMvc.perform(post("/api/v1/rooms").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name": "철수"}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.shareToken").value("share"));
	}

	@Test
	void openingBeforeFinishingIsConflict() throws Exception {
		given(roomService.open("token", "철수")).willThrow(new ResponseStatusException(HttpStatus.CONFLICT));

		mockMvc.perform(post("/api/v1/rooms").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name": "철수"}
					"""))
			.andExpect(status().isConflict());
	}

	@Test
	void rejectsOpenWithoutName() throws Exception {
		mockMvc.perform(post("/api/v1/rooms").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("{}"))
			.andExpect(status().isBadRequest());

		then(roomService).should(never()).open(any(), any());
	}

	@Test
	void returnsMyRoom() throws Exception {
		given(roomService.mine("token")).willReturn(Optional.of(new ShareRoom(1L, "share", "철수", Instant.now())));

		mockMvc.perform(get("/api/v1/rooms/mine").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.shareToken").value("share"))
			.andExpect(jsonPath("$.ownerName").value("철수"));
	}

	@Test
	void myRoomIsEmptyBeforeSharing() throws Exception {
		given(roomService.mine("token")).willReturn(Optional.empty());

		mockMvc.perform(get("/api/v1/rooms/mine").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isNoContent());
	}

	@Test
	void returnsRoom() throws Exception {
		given(roomService.room("token", "share")).willReturn(new RoomView("철수", List.of(new CategoryBits("food", 717)),
				3, new ViewerView(Role.MEMBER, true, 7L)));

		mockMvc.perform(get("/api/v1/rooms/share").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.ownerName").value("철수"))
			.andExpect(jsonPath("$.owner[0].code").value("food"))
			.andExpect(jsonPath("$.owner[0].answerBits").value(717))
			.andExpect(jsonPath("$.planets").value(3))
			.andExpect(jsonPath("$.viewer.role").value("MEMBER"))
			.andExpect(jsonPath("$.viewer.complete").value(true))
			.andExpect(jsonPath("$.viewer.planetId").value(7));
	}

	@Test
	void joinsUniverse() throws Exception {
		given(roomService.join("token", "share", "영희")).willReturn(7L);

		mockMvc.perform(post("/api/v1/rooms/share/planets").cookie(new Cookie("guest_token", "token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"name": "영희"}
					"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.planetId").value(7));
	}

	@Test
	void returnsUniverse() throws Exception {
		given(roomService.universe(null, "share"))
			.willReturn(new UniverseView(List.of(new PlanetView(7, "영희", 85, false))));

		mockMvc.perform(get("/api/v1/rooms/share/universe"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.planets[0].id").value(7))
			.andExpect(jsonPath("$.planets[0].name").value("영희"))
			.andExpect(jsonPath("$.planets[0].match").value(85))
			.andExpect(jsonPath("$.planets[0].me").value(false));
	}

	@Test
	void comparesWithViewer() throws Exception {
		given(roomService.compare("token", "share"))
			.willReturn(new ComparisonView("철수", null, null, 85, List.of(new CategoryMatch("food", 1, 3, 9))));

		mockMvc.perform(get("/api/v1/rooms/share/compare").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.ownerName").value("철수"))
			.andExpect(jsonPath("$.planetId").doesNotExist())
			.andExpect(jsonPath("$.match").value(85))
			.andExpect(jsonPath("$.categories[0].code").value("food"))
			.andExpect(jsonPath("$.categories[0].ownerBits").value(1))
			.andExpect(jsonPath("$.categories[0].otherBits").value(3))
			.andExpect(jsonPath("$.categories[0].matched").value(9));
	}

	@Test
	void returnsPlanetForOwner() throws Exception {
		given(roomService.planet("token", "share", 7))
			.willReturn(new PlanetDetailView(7, "영희", 90, List.of(new CategoryMatch("food", 1, 3, 9))));

		mockMvc.perform(get("/api/v1/rooms/share/planets/7").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.id").value(7))
			.andExpect(jsonPath("$.name").value("영희"))
			.andExpect(jsonPath("$.match").value(90))
			.andExpect(jsonPath("$.categories[0].ownerBits").value(1))
			.andExpect(jsonPath("$.categories[0].otherBits").value(3));
	}

	@Test
	void planetIsForbiddenToOthers() throws Exception {
		given(roomService.planet("token", "share", 7)).willThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));

		mockMvc.perform(get("/api/v1/rooms/share/planets/7").cookie(new Cookie("guest_token", "token")))
			.andExpect(status().isForbidden());
	}

	@Test
	void otherGuestsCannotBeCompared() throws Exception {
		mockMvc.perform(get("/api/v1/rooms/share/compare/7")).andExpect(status().isNotFound());
	}

}
