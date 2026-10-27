package model

// FlowReportCursor keeps one receipt per agent process. Agents send only one
// unacknowledged batch at a time, so a cursor also rejects delayed old batches.
type FlowReportCursor struct {
	NodeID      int64  `gorm:"primaryKey;autoIncrement:false"`
	ProducerID  string `gorm:"primaryKey;size:64"`
	Sequence    int64
	PayloadHash string `gorm:"size:64"`
	UpdatedTime int64
}

func (FlowReportCursor) TableName() string { return "flow_report_cursor" }
