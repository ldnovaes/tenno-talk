package com.tennotalk.recommender.signals;

/** Shared math of the signals. */
final class Signals {

    private Signals() {}

    /** Maps any real number into (-1, 1), keeping the sign; NaN becomes 0. */
    static double squash(double value) {
        if (Double.isNaN(value)) return 0;
        if (Double.isInfinite(value)) return Math.signum(value);
        return value / (1 + Math.abs(value));
    }
}
