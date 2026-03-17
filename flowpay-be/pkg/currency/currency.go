package currency

func ToMinorUnits(major int64, minorPerMajor int64) int64 {
	return major * minorPerMajor
}

func FromMinorUnits(minor int64, minorPerMajor int64) (major, remainder int64) {
	major = minor / minorPerMajor
	remainder = minor % minorPerMajor
	return
}

const StandardMinorPerMajor int64 = 100
