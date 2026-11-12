package com.isitjustme.site;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Limits how often one address may write: new guests, answers, rooms, planets and
 * events. Without it, a script could add thousands of fake guests and bend every share
 * the site shows. Reading is not limited. Over the limit the answer is 429.
 *
 * <p>
 * The address is the request's remote address. Behind a proxy that is the proxy, so the
 * server must trust the proxy's forwarded header (see PROJECT.md, deployment checklist).
 */
@Configuration
public class RateLimitGuard implements WebMvcConfigurer, HandlerInterceptor {

	private static final Duration MINUTE = Duration.ofMinutes(1);

	private final RateLimiter limiter = new RateLimiter(Clock.systemUTC());

	private final boolean enabled;

	private final List<Rule> rules;

	public RateLimitGuard(@Value("${site.rate-limit.enabled:true}") boolean enabled) {
		this.enabled = enabled;
		this.rules = List.of(
				// a new guest per request when the cookie is missing: the cheapest way to flood
				new Rule("guest", "POST", "/api/v1/guests/session", 30),
				new Rule("answer", "PUT", "/api/v1/categories/", 30),
				new Rule("room", "POST", "/api/v1/rooms", 20),
				new Rule("event", "POST", "/api/v1/events", 120),
				new Rule("profile", "PUT", "/api/v1/guests/profile", 20));
	}

	@Bean
	RateLimiter rateLimiter() {
		return limiter;
	}

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(this).addPathPatterns("/api/**").excludePathPatterns("/api/v1/admin/**");
	}

	@Override
	public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
		if (!enabled) {
			return true;
		}
		String path = request.getRequestURI();
		for (Rule rule : rules) {
			if (rule.matches(request.getMethod(), path)) {
				if (limiter.tryAcquire(rule.name() + ":" + request.getRemoteAddr(), rule.perMinute(), MINUTE)) {
					return true;
				}
				response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
				response.setHeader(HttpHeaders.RETRY_AFTER, "60");
				return false;
			}
		}
		return true;
	}

	/**
	 * @param path a path, or a prefix when it ends with a slash
	 */
	private record Rule(String name, String method, String path, int perMinute) {

		boolean matches(String requestMethod, String requestPath) {
			if (!method.equals(requestMethod)) {
				return false;
			}
			return path.endsWith("/") ? requestPath.startsWith(path) : requestPath.equals(path)
					|| requestPath.startsWith(path + "/");
		}

	}

}
