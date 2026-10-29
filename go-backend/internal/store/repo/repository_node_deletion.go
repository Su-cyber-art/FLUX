package repo

import (
	"errors"
	"fmt"

	"go-backend/internal/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Preserve the enrollment until the node confirms cleanup. The intent survives
// panel restarts and is retried when an offline agent reconnects.
func (r *Repository) BeginNodeDeletion(id int64) error {
	return r.beginNodeDeletion(id, false)
}

// BeginForceNodeDeletion persists the panel-only intent so a failed local
// deletion never turns into an unintended agent uninstall after reconnect.
func (r *Repository) BeginForceNodeDeletion(id int64) error {
	return r.beginNodeDeletion(id, true)
}

func (r *Repository) beginNodeDeletion(id int64, force bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var node model.Node
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&node, id).Error; err != nil {
			return err
		}
		if err := ensureNodeUnreferenced(tx, id); err != nil {
			return err
		}
		if force {
			return tx.Model(&model.Node{}).Where("id = ?", id).Update("delete_state", model.NodeDeletionPanelOnly).Error
		}
		if node.DeleteState > 0 {
			return nil
		}
		return tx.Model(&model.Node{}).Where("id = ?", id).Update("delete_state", 1).Error
	})
}

func ensureNodeUnreferenced(tx *gorm.DB, id int64) error {
	for _, dependency := range []struct {
		table interface{}
		name  string
	}{
		{&model.ChainTunnel{}, "隧道"},
		{&model.ForwardPort{}, "转发"},
		{&model.FederationTunnelBinding{}, "联邦隧道"},
		{&model.PeerShare{}, "节点共享"},
		{&model.PeerShareRuntime{}, "共享运行资源"},
	} {
		var count int64
		if err := tx.Model(dependency.table).Where("node_id = ?", id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return fmt.Errorf("节点仍被 %d 个%s引用，请先删除或迁移关联资源后重试", count, dependency.name)
		}
	}
	return nil
}

func (r *Repository) MarkNodeCleanupComplete(id int64) error {
	result := r.db.Model(&model.Node{}).Where("id = ? AND delete_state = 1", id).Update("delete_state", 2)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("节点清理状态已改变，请重试")
	}
	return nil
}
