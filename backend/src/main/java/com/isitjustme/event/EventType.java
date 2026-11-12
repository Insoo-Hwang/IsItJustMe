package com.isitjustme.event;

/**
 * Actions the pages report. A new type needs no migration; the dashboard decides which
 * ones it shows.
 */
public enum EventType {

	/** An ad was shown. */
	AD_VIEW,

	/** An ad was opened. */
	AD_CLICK,

	/** An ad was skipped. */
	AD_SKIP,

	/** The taste universe link was shared from the summary or the invite page. */
	SHARE_UNIVERSE,

	/** A "나만 그래?" link was shared from a category result. */
	SHARE_DEBATE,

	/** A friend opened an invite link. */
	INVITE_OPEN,

	/** A friend opened a "나만 그래?" link. */
	DEBATE_OPEN,

	/** A friend took a side on a "나만 그래?" link. */
	DEBATE_PICK,

	/** The taste card image was saved. */
	CARD_SAVE,

	/** The ending was opened. */
	ENDING_OPEN;

	/** Ad actions name the ad and the spot it was shown in. */
	public boolean isAd() {
		return this == AD_VIEW || this == AD_CLICK || this == AD_SKIP;
	}

}
