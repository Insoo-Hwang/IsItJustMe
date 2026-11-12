package com.isitjustme.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.isitjustme.guest.GuestTokens;

import lombok.extern.slf4j.Slf4j;

/**
 * Admin APIs need the admin token in the {@code X-Admin-Token} header. The token comes
 * from {@code admin.token} (the ADMIN_TOKEN environment variable). Without one, a random
 * token is made on startup and written to the log, so the admin page is never open by
 * accident and never shares a default password.
 */
@Slf4j
@Configuration
public class AdminAuth implements WebMvcConfigurer, HandlerInterceptor {

	public static final String HEADER = "X-Admin-Token";

	private final byte[] token;

	public AdminAuth(@Value("${admin.token:}") String configured) {
		String value = configured;
		if (value.isBlank()) {
			value = GuestTokens.generate();
			log.info("No admin.token set. Admin token for this run: {}", value);
		}
		this.token = value.getBytes(StandardCharsets.UTF_8);
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/v1/admin/**");
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		String given = request.getHeader(HEADER);
		// compared in constant time, so the response time says nothing about the token
		if (given != null && MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8))) {
			return true;
		}
		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		return false;
	}

}
