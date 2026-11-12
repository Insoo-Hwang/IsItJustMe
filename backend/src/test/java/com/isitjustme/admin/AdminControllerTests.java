package com.isitjustme.admin;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.isitjustme.admin.AdminDashboard.Totals;

@WebMvcTest(controllers = AdminController.class, properties = "admin.token=let-me-in")
@Import(AdminAuth.class)
class AdminControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private AdminDashboardRepository dashboardRepository;

	@MockitoBean
	private AdReportRepository adReportRepository;

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
				List.of(), List.of()));

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

	@Test
	void checksTheAdOfTheAdReport() throws Exception {
		mockMvc.perform(get("/api/v1/admin/ads").header("X-Admin-Token", "let-me-in")).andExpect(status().isOk());
		then(adReportRepository).should().report(eq(14), any(), isNull());

		mockMvc.perform(get("/api/v1/admin/ads").param("ad", "x'; DROP").header("X-Admin-Token", "let-me-in"))
			.andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/v1/admin/ads").param("ad", "swiswi-01")).andExpect(status().isUnauthorized());
		then(adReportRepository).should(never()).report(anyInt(), any(), eq("swiswi-01"));
	}

	@Test
	void locksAnAddressOutAfterTooManyWrongTokens() throws Exception {
		for (int i = 0; i < AdminAuth.MAX_FAILURES; i++) {
			mockMvc.perform(get("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "guess-" + i).with(from("10.0.0.7")))
				.andExpect(status().isUnauthorized());
		}

		// even the right token is refused from that address for a while
		mockMvc.perform(get("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "let-me-in").with(from("10.0.0.7")))
			.andExpect(status().isTooManyRequests());
		mockMvc.perform(get("/api/v1/admin/maintenance").header(AdminAuth.HEADER, "let-me-in").with(from("10.0.0.8")))
			.andExpect(status().isOk());
	}

	@Test
	void everyResponseCarriesTheBrowserProtections() throws Exception {
		mockMvc.perform(get("/api/v1/admin/maintenance"))
			.andExpect(header().string("X-Frame-Options", "DENY"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("Content-Security-Policy", containsString("frame-ancestors 'none'")));
	}

	private static RequestPostProcessor from(String address) {
		return (request) -> {
			request.setRemoteAddr(address);
			return request;
		};
	}

}
