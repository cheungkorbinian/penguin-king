export function Rules({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal rules-modal" onClick={(e) => e.stopPropagation()}>
        <h2>怎么玩 · 企鹅王</h2>
        <section>
          <h3>流程</h3>
          <p>一共 10 轮。第 1 轮每人 1 张牌，第 2 轮 2 张……第 10 轮 10 张。每轮先同时竞标「我要赢几墩」，再轮流出牌。</p>
        </section>
        <section>
          <h3>跟牌</h3>
          <p>第一张数字牌决定本墩花色。有该花色就必须出该花色（或任意特殊牌）。没有就可以随便出。特殊牌随时能出，不必跟牌。</p>
        </section>
        <section>
          <h3>谁赢这一墩</h3>
          <ul>
            <li>人鱼企鹅 克 企鹅王 克 探险企鹅 克 所有数字牌</li>
            <li>如果人鱼、企鹅王、探险企鹅同时出现：人鱼赢，且只结算「人鱼俘获企鹅王」的加分</li>
            <li>冰山是王牌花色，压过小鱼 / 贝壳 / 极光的数字牌</li>
            <li>同等级特殊牌：先出的赢</li>
            <li>条纹企鹅打出时要选择：当探险企鹅，或当肚皮滑行</li>
            <li>全员滑行时，第一张牌赢</li>
          </ul>
        </section>
        <section>
          <h3>计分（企鹅王计分法）</h3>
          <ul>
            <li>标 1 及以上且刚好猜中：每墩 +20</li>
            <li>猜错：每差 1 墩 −10，加分全部作废</li>
            <li>标 0 且一墩未赢：本轮牌数 × 10；一旦赢了墩则扣同样的分</li>
          </ul>
        </section>
        <section>
          <h3>加分（仅在竞标正确时）</h3>
          <ul>
            <li>赢走普通花色 14：+10；冰山 14：+20</li>
            <li>探险企鹅俘获人鱼：+20</li>
            <li>企鹅王俘获探险企鹅：+30</li>
            <li>人鱼俘获企鹅王：+40</li>
          </ul>
        </section>
        <section>
          <h3>进阶牌（可选）</h3>
          <ul>
            <li>深海巨妖：吞掉本墩，无人得分；本该赢的人领出下一墩</li>
            <li>白鲸：特殊牌不能赢，比场上最大数字（无视花色）</li>
            <li>巨妖和白鲸同时出现：后出的那张生效</li>
            <li>小鱼宝藏：被别人赢走后，若你们俩都竞标正确，各 +20</li>
          </ul>
        </section>
        <button className="btn primary" onClick={onClose}>
          知道啦
        </button>
      </div>
    </div>
  );
}
