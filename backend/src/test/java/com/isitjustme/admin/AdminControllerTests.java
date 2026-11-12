package com.isitjustme.admin;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.isitjustme.admin.AdminDashboard.Totals;

@WebMvcTest(controllers = AdminController.class, properties = "admin.token=let-me-in")
@Import(AdminAuth.class)
class AdminControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private AdminDashboardRepository dashboardRepository;

	@Test
	void rejectsRequestsWithoutTheToken() throws Exception {
		mockMvc.perform(get("/api/v1/admin/dashboard")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/api/v1/admin/dashboard").header("X-Admin-Token", "let-me-inn"))
			.andExpect(status().isUnauthorized());

		then(dashboardRepository).should(never()).dashboard(anyInt(), any());
	}

	@Test
	void returnsTheDashboardForTheToken() throws Exception {
		given(dashboardRepository.dashboard(eq(7), any())).willReturn(new AdminDashboard(Instant.now(), 7,
				new Totals(10, 8, 6, 2, 20, 1, 3, 1), Map.of(), List.of(), List.of(), List.of(), List.of(), List.of(),
				List.of(), List.of(), List.of()));

		mockMvc.perform(get("/api/v1/admin/dashboard").param("days", "7").header("X-Admin-Token", "let-me-in"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.days").value(7))
			.andExpect(jsonPath("$.totals.guests").value(10));
	}

	@Test
	void rejectsAPeriodOutOfRange() throws Exception {
		mockMvc.perform(get("/api/v1/admin/dashboard").param("days", "0").header("X-Admin-Token", "let-me-in"))
			.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/admin/dashboard").param("days", "91").header("X-Admin-Token", "let-me-in"))
			.andExpect(status().isBadRequest());
	}

}
