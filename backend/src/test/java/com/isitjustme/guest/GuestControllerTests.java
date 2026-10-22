package com.isitjustme.guest;

import static org.mockito.BDDMockito.given;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.then;
import static org.mockito.Mockito.never;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
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
		given(guestService.resolveOrIssue(null)).willReturn(new GuestSession("new-token", true, null));

		mockMvc.perform(post("/api/v1/guests/session"))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.issued").value(true))
			.andExpect(jsonPath("$.profile").isEmpty())
			.andExpect(cookie().value("guest_token", "new-token"))
			.andExpect(cookie().httpOnly("guest_token", true))
			.andExpect(cookie().secure("guest_token", true))
			.andExpect(cookie().sameSite("guest_token", "Lax"))
			.andExpect(cookie().maxAge("guest_token", (int) Duration.ofDays(180).toSeconds()));
	}

	@Test
	void keepsExistingToken() throws Exception {
		GuestProfile profile = new GuestProfile(Gender.FEMALE, AgeGroup.TWENTIES);
		given(guestService.resolveOrIssue("old-token")).willReturn(new GuestSession("old-token", false, profile));

		mockMvc.perform(post("/api/v1/guests/session").cookie(new Cookie("guest_token", "old-token")))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.issued").value(false))
			.andExpect(jsonPath("$.profile.gender").value("FEMALE"))
			.andExpect(jsonPath("$.profile.ageGroup").value("TWENTIES"))
			.andExpect(cookie().value("guest_token", "old-token"));
	}

	@Test
	void savesProfile() throws Exception {
		GuestProfile profile = new GuestProfile(Gender.MALE, AgeGroup.THIRTIES);
		given(guestService.updateProfile("old-token", profile)).willReturn(true);

		mockMvc.perform(put("/api/v1/guests/profile").cookie(new Cookie("guest_token", "old-token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"gender": "MALE", "ageGroup": "THIRTIES"}
					"""))
			.andExpect(status().isNoContent());
	}

	@Test
	void rejectsProfileWithoutKnownToken() throws Exception {
		given(guestService.updateProfile(eq(null), any())).willReturn(false);

		mockMvc.perform(put("/api/v1/guests/profile").contentType(MediaType.APPLICATION_JSON).content("""
				{"gender": "MALE", "ageGroup": "THIRTIES"}
				"""))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void rejectsIncompleteProfile() throws Exception {
		mockMvc.perform(put("/api/v1/guests/profile").cookie(new Cookie("guest_token", "old-token"))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"gender": "MALE"}
					"""))
			.andExpect(status().isBadRequest());

		then(guestService).should(never()).updateProfile(any(), any());
	}

}
