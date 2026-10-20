package com.isitjustme.guest;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.isitjustme.guest.GuestService.GuestSession;

@WebMvcTest(GuestController.class)
class GuestControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private GuestService guestService;

	@Test
	void issuesCookieWhenNoToken() throws Exception {
		given(guestService.resolveOrIssue(null)).willReturn(new GuestSession("new-token", true));

		mockMvc.perform(post("/api/v1/guests/session"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.issued").value(true))
			.andExpect(cookie().value("guest_token", "new-token"))
			.andExpect(cookie().httpOnly("guest_token", true))
			.andExpect(cookie().secure("guest_token", true))
			.andExpect(cookie().sameSite("guest_token", "Lax"))
			.andExpect(cookie().maxAge("guest_token", (int) Duration.ofDays(180).toSeconds()));
	}

	@Test
	void keepsExistingToken() throws Exception {
		given(guestService.resolveOrIssue("old-token")).willReturn(new GuestSession("old-token", false));

		mockMvc.perform(post("/api/v1/guests/session").cookie(new Cookie("guest_token", "old-token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.issued").value(false))
			.andExpect(cookie().value("guest_token", "old-token"));
	}

}
