package repo

import (
	"testing"

	"go-backend/internal/store/model"
)

func TestForwardListsScopeOwnershipWithoutChangingAdminView(t *testing.T) {
	r := flowReportTestRepository(t)
	if err := r.DB().Create(&model.Forward{ID: 21, UserID: 3, UserName: "other-user", Name: "other-forward", TunnelID: 1, RemoteAddr: "127.0.0.1:80"}).Error; err != nil {
		t.Fatal(err)
	}
	for _, userID := range []int64{2, 3} {
		items, err := r.ListForwardsByUser(userID)
		if err != nil {
			t.Fatal(err)
		}
		if len(items) != 1 || items[0]["userId"] != userID {
			t.Fatalf("user %d received another user's records: %+v", userID, items)
		}
	}
	items, err := r.ListForwards()
	if err != nil || len(items) != 2 {
		t.Fatalf("admin view changed: items=%+v err=%v", items, err)
	}
	if _, err := r.ListForwardsByUser(0); err == nil {
		t.Fatal("invalid owner must not fall back to an unscoped query")
	}
}
