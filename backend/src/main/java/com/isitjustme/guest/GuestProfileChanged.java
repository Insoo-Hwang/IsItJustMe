package com.isitjustme.guest;

/**
 * Published inside the transaction that saved a guest's profile.
 */
public record GuestProfileChanged(Long guestId, GuestProfile profile) {
}
