package com.isitjustme.admin;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.isitjustme.guest.GuestTokens;
import com.isitjustme.site.RateLimiter;

import lombok.extern.slf4j.Slf4j;

/**
 * Admin APIs need the admin token in the {@code X-Admin-Token} header. The token comes
 * from {@code admin.token} (the ADMIN_TOKEN environment variable). Without one, a random
 * token is made on startup and written to the log, so the admin page is never open by
 * accident and never shares a default password. After {@link #MAX_FAILURES} wrong tokens
 * from one address, that address is refused for {@link #LOCKOUT}, so the token cannot be
 * guessed by trying.
 */
@Slf4j
@Configuration
public class AdminAuth implements WebMvcConfigurer, HandlerInterceptor {

	public static final String HEADER = "X-Admin-Token";

	static final int MAX_FAILURES = 10;

	static final Duration LOCKOUT = Duration.ofMinutes(15);

	/** Shorter tokens are accepted but warned about: they can be guessed. */
	private static final int STRONG_LENGTH = 24;

	private final byte[] token;

	private final RateLimiter limiter;

	public AdminAuth(@Value("${admin.token:}") String configured, RateLimiter limiter) {
		this.limiter = limiter;
		String value = configured;
		if (value.isBlank()) {
			value = GuestTokens.generate();
			log.info("No admin.token set. Admin token for this run: {}", value);
		}
		else if (value.length() < STRONG_LENGTH) {
			log.warn("admin.token is shorter than {} characters. Use a long random value before deploying.",
					STRONG_LENGTH);
		}
		this.token = value.getBytes(StandardCharsets.UTF_8);
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/v1/admin/**");
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		String key = "admin-fail:" + request.getRemoteAddr();
		if (limiter.exhausted(key, MAX_FAILURES)) {
			response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
			response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(LOCKOUT.toSeconds()));
			return false;
		}
		String given = request.getHeader(HEADER);
		// compared in constant time, so the response time says nothing about the token
		if (given != null && MessageDigest.isEqual(token, given.getBytes(StandardCharsets.UTF_8))) {
			return true;
		}
		limiter.tryAcquire(key, MAX_FAILURES, LOCKOUT);
		log.warn("Admin token refused for {}", request.getRemoteAddr());
		response.setStatus(HttpStatus.UNAUTHORIZED.value());
		return false;
	}

}
