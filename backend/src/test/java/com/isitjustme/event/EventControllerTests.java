package com.isitjustme.event;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.isitjustme.category.CategoryCatalog;
import com.isitjustme.category.CategoryCatalog.CategoryInfo;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.guest.GuestService;

@WebMvcTest(EventController.class)
class EventControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private EventRepository eventRepository;

	@MockitoBean
	private GuestService guestService;

	@MockitoBean
	private CategoryStatsCache statsCache;

	@BeforeEach
	void catalog() {
		given(statsCache.catalog()).willReturn(new CategoryCatalog(
				List.of(new CategoryInfo(1, "food", "음식 취향", "restaurant", "", "", 1, List.of(), List.of()))));
		given(guestService.findByToken(any())).willReturn(Optional.empty());
	}

	@Test
	void recordsAnEventOfAVisitorWithoutASession() throws Exception {
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"AD_VIEW\", \"category\": \"food\"}")).andExpect(status().isNoContent());

		then(eventRepository).should().save(isNull(), eq(EventType.AD_VIEW), eq("food"), any());
	}

	@Test
	void recordsAnEventWithoutACategory() throws Exception {
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"SHARE_UNIVERSE\"}")).andExpect(status().isNoContent());

		then(eventRepository).should().save(isNull(), eq(EventType.SHARE_UNIVERSE), isNull(), any());
	}

	@Test
	void rejectsUnknownTypesAndCategories() throws Exception {
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"NOT_A_TYPE\"}")).andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON)
			.content("{\"type\": \"AD_VIEW\", \"category\": \"nope\"}")).andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest());

		then(eventRepository).should(never()).save(any(), any(), any(), any());
	}

}
