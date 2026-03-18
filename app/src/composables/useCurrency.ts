const SHEKEL_SYMBOL = "₪";

export function formatShekels(value: number): string {
	return `${SHEKEL_SYMBOL}${value.toLocaleString()}`;
}

/** For chart axis: compact form with symbol, e.g. ₪1.2M, ₪50k */
export function formatShekelsCompact(value: number): string {
	if (value >= 1e6) return `${SHEKEL_SYMBOL}${(value / 1e6).toFixed(1)}M`;
	if (value >= 1e3) return `${SHEKEL_SYMBOL}${Math.round(value / 1e3)}k`;
	return `${SHEKEL_SYMBOL}${Math.round(value)}`;
}
