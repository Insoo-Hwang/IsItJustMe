package com.isitjustme.site;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.isitjustme.admin.AdReportRepository;
import com.isitjustme.admin.AdminAuth;
import com.isitjustme.admin.AdminController;
import com.isitjustme.admin.AdminDashboardRepository;
import com.isitjustme.category.CategoryCatalog;
import com.isitjustme.category.CategoryStatsCache;
import com.isitjustme.event.EventController;
import com.isitjustme.event.EventRepository;
import com.isitjustme.guest.GuestService;

@WebMvcTest(controllers = { AdminController.class, EventController.class }, properties = "admin.token=let-me-in")
@Import({ AdminAuth.class, MaintenanceGuard.class })
class MaintenanceGuardTests {

	private static final String SHARE = "{\"type\": \"SHARE_UNIVERSE\"}";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private MaintenanceMode maintenance;

	@MockitoBean
	private AdminDashboardRepository dashboardRepository;

	@MockitoBean
	private AdReportRepository adReportRepository;

	@MockitoBean
	private EventRepository eventRepository;

	@MockitoBean
	private GuestService guestService;

	@MockitoBean
	private CategoryStatsCache statsCache;

	@AfterEach
	void open() {
		maintenance.set(false, null);
	}

	@Test
	void closesVisitorApisWithTheMessageWhileAdminApisStayOpen() throws Exception {
		given(statsCache.catalog()).willReturn(new CategoryCatalog(List.of()));
		given(guestService.findByToken(any())).willReturn(Optional.empty());
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON).content(SHARE))
			.andExpect(status().isNoContent());

		mockMvc
			.perform(put("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "let-me-in")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"enabled\": true, \"message\": \"서버 \\\"이사\\\" 중\"}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.enabled").value(true))
			.andExpect(jsonPath("$.since").isNotEmpty());

		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON).content(SHARE))
			.andExpect(status().isServiceUnavailable())
			.andExpect(jsonPath("$.maintenance").value(true))
			.andExpect(jsonPath("$.message").value("서버 \"이사\" 중"));
		mockMvc.perform(get("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "let-me-in"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.enabled").value(true));

		mockMvc
			.perform(put("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "let-me-in")
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"enabled\": false}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.since").doesNotExist());
		mockMvc.perform(post("/api/v1/events").contentType(MediaType.APPLICATION_JSON).content(SHARE))
			.andExpect(status().isNoContent());
	}

	@Test
	void onlyTheAdminCanSwitchIt() throws Exception {
		mockMvc.perform(put("/api/v1/admin/maintenance").contentType(MediaType.APPLICATION_JSON)
			.content("{\"enabled\": true}")).andExpect(status().isUnauthorized());

		assertThat(maintenance.state().enabled()).isFalse();
	}

	@Test
	void fallsBackToTheDefaultMessage() {
		assertThat(maintenance.set(true, "  ").message()).isEqualTo(MaintenanceMode.DEFAULT_MESSAGE);
		assertThat(MaintenanceGuard.quote("a\"b\\c\nd")).isEqualTo("\"a\\\"b\\\\c\\nd\"");
	}

}
