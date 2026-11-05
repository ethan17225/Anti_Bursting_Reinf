# TECHNICAL SPECIFICATION: AUTO-FIX COST OPTIMIZATION & VIETNAM HIGH-RISE UX/PRESETS

> **Hướng dẫn dành cho AI Coding Agent:** Tài liệu này là bản mở rộng chuyên sâu kết nối trực tiếp với lõi tính toán (`calculationEngine.ts`) và bộ hiển thị 3D (`PileCapScene3D.tsx`). Bạn cần hiện thực hóa đầy đủ: (1) Bộ giải tối ưu hóa chi phí đa kịch bản, (2) Cơ sở dữ liệu 6 mẫu đài cọc nhà cao tầng thực tế tại Việt Nam theo TCVN 5574:2018 & TCVN 10304:2014, và (3) Giao diện kỹ thuật "Blueprint Dark Mode" kèm hệ thống phím tắt thao tác nhanh.

---

## PHẦN 1: TÍNH NĂNG ĐỘT PHÁ "AUTO-FIX & COST OPTIMIZATION" (TỰ ĐỘNG SỬA LỖI & TỐI ƯU HÓA CHI PHÍ)

### 1.1. Bản chất Vật lý & Kinh tế của Bài toán Tối ưu Đài cọc

Trong thiết kế đài cọc chịu tải trọng lớn, khi tăng chiều cao đài $h$ thêm một lượng $\Delta h$:
1. **Chi phí tăng thêm:** Thể tích bê tông đài ($V_{conc}$), diện tích ván khuôn thành ($A_{form}$) và khối lượng đào đất hố móng ($V_{exc}$) tăng tuyến tính theo $h$.
2. **Chi phí giảm mạnh (Phi tuyến):**
   * Góc nghiêng thanh chống $\theta_i = \arctan\left(\frac{z}{a_i}\right)$ tăng lên $\implies \sin\theta_i$ tăng và $\cot\theta_i$ giảm.
   * Ứng suất nén trong thanh chống bê tông giảm theo bình phương $\sin\theta_i$:
     $$\sigma_{c,strut,i} = \frac{R_i \cdot 10^3}{A_p \cdot \sin^2\theta_i}$$
   * Lực kéo ngang gây bứt tách quy đổi $T_{burst,h,i}$ giảm xấp xỉ tỷ lệ nghịch với $\sin^2\theta_i$, giúp giảm mạnh lượng cốt thép chống bứt tách $A_{s,burst}$.
   * Lực kéo trong cốt thép chủ đáy đài $T_{main,i} = R_i \cdot \cot\theta_i$ cũng giảm trực tiếp theo $\frac{1}{z}$, giúp tiết kiệm hàng trăm kilôgam thép chủ đáy đài ($A_{s,main}$).

Do đó, một bộ tối ưu hóa thực thụ **bắt buộc phải tính tổng chi phí của cả hệ thống**: **Bê tông + Thép chống bứt tách + Thép chủ chịu kéo đáy đài + Ván khuôn & Đào đất**.

---

### 1.2. Hàm Mục Tiêu Chi Phí Toàn Cục (Total Cost Objective Function - Đơn vị: VNĐ)

AI Agent cần tạo bảng cấu hình đơn giá mặc định sát với mặt bằng giá xây dựng phần ngầm nhà cao tầng tại Việt Nam (cho phép người dùng chỉnh sửa trong phần Cài đặt):

#### A. Bảng đơn giá mặc định (`CostUnitRates`):
```typescript
export interface CostUnitRates {
  concretePricePerM3: Record<string, number>; // VNĐ / m3 (Bê tông thương phẩm + bơm + phụ gia)
  rebarPricePerKg: number;                    // VNĐ / kg (Thép CB400-V/CB500-V + gia công lắp dựng)
  formworkPricePerM2: number;                 // VNĐ / m2 (Ván khuôn thành đài / xây gạch lót)
  excavationPricePerM3: number;               // VNĐ / m3 (Đào đất sâu + vận chuyển đổ thải)
}

export const DEFAULT_VN_COST_RATES: CostUnitRates = {
  concretePricePerM3: {
    B25: 1450000,
    B30: 1580000,
    B35: 1720000,
    B40: 1890000,
    B45: 2100000,
    B50: 2350000,
  },
  rebarPricePerKg: 22500,
  formworkPricePerM2: 280000,
  excavationPricePerM3: 320000,
};
```

#### B. Công thức tính Khối lượng & Chi phí thành phần:

1. **Chi phí Bê tông đài cọc ($C_{conc}$):**
   $$V_{conc} = \frac{L_x \cdot L_y \cdot h}{10^9} \quad (\text{m}^3)$$
   $$C_{conc} = V_{conc} \cdot P_{conc}(\text{Grade})$$

2. **Khối lượng & Chi phí Cốt thép chống bứt tách ($M_{burst}, C_{steel,burst}$):**
   * Chiều dài 1 nhánh thép phương $X$ và phương $Y$ (kể cả đoạn bẻ móc neo $10\phi$ ở hai đầu và lớp bảo vệ mặt bên $c_{side} = 75\text{ mm}$):
     $$L_{bar,X} = (L_x - 150) + 20 \cdot \phi \quad (\text{mm})$$
     $$L_{bar,Y} = (L_y - 150) + 20 \cdot \phi \quad (\text{mm})$$
   * Tổng chiều dài thép chống bứt tách của toàn bộ `numLayers` lớp:
     $$L_{total,burst} = \text{numLayers} \cdot \left( \text{legsPerLayerX} \cdot L_{bar,X} + \text{legsPerLayerY} \cdot L_{bar,Y} \right) \cdot 10^{-3} \quad (\text{m})$$
   * Khối lượng thép chống bứt tách ($\rho_{steel} = 7850\text{ kg/m}^3$):
     $$M_{burst} = L_{total,burst} \cdot \left(\frac{\pi \cdot \phi^2}{4} \cdot 10^{-6}\right) \cdot 7850 \quad (\text{kg})$$

3. **Khối lượng & Chi phí Cốt thép chủ đáy đài ($M_{main}, C_{steel,main}$):**
   * Tổng lực kéo giằng chính tại đáy đài theo phương $X$ và phương $Y$:
     $$T_{main,X} = \max\left( \sum_{x_i \ge 0} R_i \cdot \frac{e_{x,i}}{z}, \sum_{x_i < 0} R_i \cdot \frac{e_{x,i}}{z} \right) \quad (\text{kN})$$
     $$T_{main,Y} = \max\left( \sum_{y_i \ge 0} R_i \cdot \frac{e_{y,i}}{z}, \sum_{y_i < 0} R_i \cdot \frac{e_{y,i}}{z} \right) \quad (\text{kN})$$
   * Diện tích thép chủ đáy đài yêu cầu:
     $$A_{s,main,X} = \max\left(\frac{T_{main,X} \cdot 10^3}{f_{yd}}, 0.0015 \cdot L_y \cdot d\right) \quad (\text{mm}^2)$$
     $$A_{s,main,Y} = \max\left(\frac{T_{main,Y} \cdot 10^3}{f_{yd}}, 0.0015 \cdot L_x \cdot d\right) \quad (\text{mm}^2)$$
   * Khối lượng thép chủ đáy đài (nhân hệ số $1.18$ kể đến bẻ mỏ neo lên mặt bên đài):
     $$M_{main} = 1.18 \cdot \left( A_{s,main,X} \cdot L_x + A_{s,main,Y} \cdot L_y \right) \cdot 10^{-9} \cdot 7850 \quad (\text{kg})$$
   * Tổng chi phí cốt thép:
     $$C_{steel} = (M_{burst} + M_{main}) \cdot P_{steel}$$

4. **Chi phí Ván khuôn thành & Đào đất hố móng ($C_{form\_exc}$):**
   $$A_{form} = \frac{2 \cdot (L_x + L_y) \cdot h}{10^6} \quad (\text{m}^2)$$
   $$V_{exc} = 1.25 \cdot V_{conc} \quad (\text{m}^3)$$
   $$C_{form\_exc} = A_{form} \cdot P_{form} + V_{exc} \cdot P_{exc}$$

5. **Tổng chi phí quy đổi của đài cọc ($C_{total}$):**
   $$C_{total} = C_{conc} + C_{steel} + C_{form\_exc} \quad (\text{VNĐ})$$

---

### 1.3. Hệ Ràng Buộc Khả Thi (Strict Engineering Constraints)

Một phương án thiết kế $\mathbf{X} = (h, \text{Grade}, \phi, \text{numLayers}, \text{legsX}, \text{legsY})$ chỉ được coi là **Hợp lệ (Feasible)** khi thỏa mãn đồng thời 6 điều kiện sau:

1. **Ràng buộc Góc nghiêng thanh chống:**
   $$\min_{i}(\theta_i) \ge 26.5^\circ \quad (\text{tương đương } \cot\theta_i \le 2.0)$$
2. **Ràng buộc Chống ép vỡ bê tông thanh chống (Strut Crushing):**
   $$UR_{crush} = \max_{i}\left(\frac{\sigma_{c,strut,i}}{\sigma_{Rd,max}}\right) \le 0.98$$
3. **Ràng buộc Đủ diện tích cốt thép chống bứt tách 2 phương:**
   $$UR_{burst,X} = \frac{A_{s,burst,X,req}}{A_{s,burst,X,prov}} \le 0.98, \quad UR_{burst,Y} = \frac{A_{s,burst,Y,req}}{A_{s,burst,Y,prov}} \le 0.98$$
4. **Ràng buộc Khoảng cách đứng giữa các lớp thép ($s_v$ - Đảm bảo thi công & Hạn chế bề rộng vết nứt):**
   $$110\text{ mm} \le s_v = \frac{0.8 \cdot z}{\text{numLayers} - 1} \le 280\text{ mm}$$
5. **Ràng buộc Khoảng hở thông thủy ngang để đút lọt đầm dùi bê tông ($s_{clear,h}$):**
   $$s_{clear,X} = \frac{L_y - 150}{\text{legsPerLayerX} - 1} - \phi \ge 100\text{ mm}$$
   $$s_{clear,Y} = \frac{L_x - 150}{\text{legsPerLayerY} - 1} - \phi \ge 100\text{ mm}$$
6. **Ràng buộc Tỷ lệ đường kính thép hợp lý:**
   * Với đài có $h \ge 2000\text{ mm}$: $\phi \ge 14\text{ mm}$ (đảm bảo độ cứng lồng thép khi cẩu lắp).

---

### 1.4. Thuật Toán Đề Xuất 3 Kịch Bản Tối Ưu (3-Strategy Recommendation Engine)

Thay vì tự ý thay đổi thông số của người dùng, khi bấm nút **`[⚡ Auto-Fix & Tối ưu chi phí]`**, hệ thống quét toàn bộ không gian nghiệm rời rạc (thời gian chạy $< 15\text{ ms}$) và trả về **3 thẻ kịch bản (Strategy Cards)** rõ ràng để kỹ sư lựa chọn:

* **Kịch bản 1 — `REBAR_ONLY` (Giữ nguyên Kích thước đài & Mác bê tông - Chỉ tối ưu Lồng thép):**
  * **Mục đích:** Dành cho giai đoạn đã chốt bản vẽ kích thước bê tông với kiến trúc/địa chất, chỉ muốn tìm tổ hợp $(\phi, \text{numLayers}, \text{legsX}, \text{legsY})$ có khối lượng thép $M_{burst}$ nhỏ nhất mà vẫn đạt chuẩn cấu tạo.
  * *Lưu ý:* Nếu kích thước hiện tại bị lỗi ép vỡ bê tông ($UR_{crush} > 1.0$) hoặc góc $\theta < 25^\circ$, thẻ này sẽ hiện nhãn *"Không khả thi do bê tông đã bị ép vỡ — Cần áp dụng Kịch bản 2 hoặc 3"*.

* **Kịch bản 2 — `UPGRADE_CONCRETE_KEEP_H` (Giữ nguyên Chiều cao đài $h$ - Nâng Mác bê tông & Tối ưu thép):**
  * **Mục đích:** Cực kỳ hữu ích khi cao độ đáy móng bị khống chế cứng bởi mực nước ngầm hoặc chiều sâu tường vây (không thể đào sâu thêm để tăng $h$), nhưng thanh chống đang bị quá tải nén. Thuật toán tự động nâng cấp độ bền bê tông (ví dụ từ `B30` $\rightarrow$ `B40`) kết hợp chọn lại lồng thép tối ưu.

* **Kịch bản 3 — `GLOBAL_MIN_COST` (Tối ưu Tổng Chi Phí Toàn Cục - Khuyên dùng):**
  * **Mục đích:** Cho phép thay đổi đồng thời chiều cao đài $h \in [h_{min}, h_{max}]$ (bước nhảy $100\text{ mm}$), cấp độ bền bê tông (`B30` đến `B45`) và cấu hình lồng thép để tìm điểm rơi có **Tổng chi phí $C_{total}$ thấp nhất**, kèm thông báo số tiền tiết kiệm được (VNĐ và %) so với thiết kế ban đầu.

#### Mã nguồn chuẩn cho Module Optimizer (`src/core/costOptimizer.ts`):

```typescript
export interface OptimizationCandidate {
  strategyType: 'REBAR_ONLY' | 'UPGRADE_CONCRETE_KEEP_H' | 'GLOBAL_MIN_COST';
  title: string;
  description: string;
  feasible: boolean;
  infeasibleReason?: string;
  proposedChanges: {
    h: number;
    concreteGrade: string;
    fck: number;
    fcd: number;
    barDiameter: number;
    numLayers: number;
    legsPerLayerX: number;
    legsPerLayerY: number;
  };
  metrics: {
    minThetaDeg: number;
    maxCrushingUR: number;
    maxBurstingUR: number;
    verticalSpacingSv: number;
    burstingSteelMassKg: number;
    mainSteelMassKg: number;
    concreteVolumeM3: number;
    totalCostVND: number;
    costDeltaVND: number; // Âm (-) là tiết kiệm tiền, Dương (+) là chi phí tăng thêm để sửa lỗi
    costDeltaPercent: number;
  };
}
```

---

### 1.5. Biểu Đồ Tương Quan Chi Phí Theo Chiều Cao Đài (Interactive Cost vs. Height Trade-off Chart)

Bên dưới 3 thẻ kịch bản, AI Agent cần dựng một biểu đồ đường/cột chồng trực quan (dùng SVG hoặc Recharts) khảo sát $h$ chạy từ $h_{current} - 400\text{ mm}$ đến $h_{current} + 600\text{ mm}$ (mỗi nấc $100\text{ mm}$):
* **Đường màu Xanh lam:** Chi phí Bê tông + Ván khuôn + Đào đất (tăng dần theo $h$).
* **Đường màu Cam:** Chi phí Cốt thép tổng (Thép chủ + Thép chống bứt tách — giảm mạnh khi tăng $h$).
* **Đường màu Xanh lục đậm (Đỉnh Parabol ngược):** Tổng chi phí $C_{total}$, đánh dấu ngôi sao vàng tại điểm **Optimal Height ($h_{opt}$)**.
* Các vùng $h$ làm bê tông bị ép vỡ ($\sigma_{c,strut} > \sigma_{Rd,max}$) được tô nền gạch chéo màu đỏ nhạt (`Crushing Zone`).

---

## PHẦN 2: NGHIÊN CỨU CHI TIẾT & BỘ 6 DỰ ÁN MẪU NHÀ CAO TẦNG TẠI VIỆT NAM (VIETNAM HIGH-RISE PRESETS)

### 2.1. Đặc thù Thiết kế Đài cọc Nhà cao tầng tại Việt Nam

Để ứng dụng tạo được sự đồng cảm ngay lập tức với các kỹ sư kết cấu tại Việt Nam (Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng...), toàn bộ hệ thống thông số mặc định và thư viện mẫu phải phản ánh đúng thực tế thi công móng sâu tại Việt Nam theo **TCVN 5574:2018** và **TCVN 10304:2014 (Móng cọc)**:

1. **Vật liệu Bê tông (Cấp độ bền nén $B$ theo TCVN 5574:2018 - Bảng 7):**
   * Nhà cao tầng tại Việt Nam hiện nay hầu như không dùng bê tông dưới B25 cho đài cọc. Phổ biến nhất là **B30**, **B35**, **B40** và **B45**.
   * Bảng tra chính xác cần nạp cứng vào App:

| Cấp độ bền (TCVN 5574:2018) | Tương đương Eurocode 2 | $R_b = f_{cd}$ ($\text{MPa}$) | $R_{bt} = f_{ctd}$ ($\text{MPa}$) | $f_{ck}$ quy đổi tính $\nu'$ ($\text{MPa}$) | Mô đun đàn hồi $E_b$ ($\text{MPa}$) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **B25** | C20/25 | $14.5$ | $1.05$ | $20.0$ | $30000$ |
| **B30** | C25/30 | $17.0$ | $1.15$ | $25.0$ | $32500$ |
| **B35** | C30/37 | $19.5$ | $1.30$ | $30.0$ | $34500$ |
| **B40** | C35/45 | $22.0$ | $1.40$ | $35.0$ | $36000$ |
| **B45** | C40/50 | $25.0$ | $1.50$ | $40.0$ | $37000$ |
| **B50** | C45/55 | $27.5$ | $1.60$ | $45.0$ | $38000$ |

2. **Vật liệu Cốt thép (Theo TCVN 1651-2:2018 & TCVN 5574:2018):**
   * **CB300-V:** $R_s = f_{yd} = 260\text{ MPa}$, $R_{sw} = 210\text{ MPa}$.
   * **CB400-V (Phổ biến nhất):** $R_s = f_{yd} = 350\text{ MPa}$, $R_{sw} = 280\text{ MPa}$ ($f_{yk} = 400\text{ MPa}$).
   * **CB500-V (Nhà siêu cao tầng $\ge 35$ tầng):** $R_s = f_{yd} = 435\text{ MPa}$, $R_{sw} = 300\text{ MPa}$ ($f_{yk} = 500\text{ MPa}$).

3. **Cấu tạo Chiều dày lớp bảo vệ đáy đài ($c$) tại Việt Nam:**
   * Đập đầu cọc khoan nhồi / cọc ly tâm ngàm vào đài từ $100\text{ mm}$ đến $150\text{ mm}$.
   * Lớp thép chủ đáy đài đặt ngay trên đỉnh đầu cọc, do đó khoảng cách từ đáy đài đến trọng tâm cốt thép chủ chịu kéo thực tế là $c = 150\text{ mm} \div 250\text{ mm}$ (lớn hơn rất nhiều so với dầm/sàn thông thường).

---

### 2.2. Chi Tiết 6 Dự Án Mẫu Nhà Cao Tầng Điển Hình Tại Việt Nam (`VN_HIGHRISE_PRESETS`)

AI Agent phải tích hợp sẵn 6 mẫu dự án dưới đây vào thanh chọn nhanh **"Mẫu Đài Cọc Thực Tế (VN High-Rise Presets)"** kèm mô tả ngữ cảnh công trình:

#### 1. `VN_PRESET_01`: Chung cư 20–25 tầng — Đài 4 Cọc Ly Tâm PHC D600
* **Ngữ cảnh thực tế:** Chung cư thương mại 22 tầng + 1 tầng hầm tại vùng đất yếu / trung bình (Bình Dương, Long An, Gia Lâm, Đông Anh). Sử dụng cọc ống bê tông ly tâm dự ứng lực PHC-A D600 ép hoặc đóng, sức chịu tải tính toán $240\text{--}270\text{ tấn/cọc}$.
* **Đặc điểm kỹ thuật:** Cọc đường kính $D_p = 600\text{ mm}$ tương đối nhỏ so với tải trọng $2400\text{ kN/cọc}$, dẫn đến diện tích tiết diện đầu cọc $A_p$ nhỏ $\implies$ **Rất dễ bị phá hoại ép vỡ bê tông thanh chống tại đầu cọc** nếu chiều cao đài $h < 1500\text{ mm}$ hoặc dùng bê tông dưới B30.
* **Thông số chuẩn:**
  * Bê tông: `B30` ($f_{cd} = 17.0\text{ MPa}$), Thép: `CB400-V` ($f_{yd} = 350\text{ MPa}$).
  * Cột vách chữ nhật: $b_c = 700\text{ mm}, h_c = 1100\text{ mm}$.
  * Kích thước đài: $L_x = 3000\text{ mm}, L_y = 3000\text{ mm}, h = 1600\text{ mm}, c = 180\text{ mm}$.
  * Cọc tròn $D_p = 600\text{ mm}$, khoảng cách $3D_p = 1800\text{ mm} \implies 4$ cọc tại $(\pm 900, \pm 900)\text{ mm}$.
  * Nội lực chân cột: $N_{Ed} = 9200\text{ kN}, M_{Ed,x} = 450\text{ kN}\cdot\text{m}, M_{Ed,y} = 300\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `4 lớp`, `4 nhánh X + 4 nhánh Y`, đường kính `Ø16`.

#### 2. `VN_PRESET_02`: Cao ốc 28–32 tầng — Đài 3 Cọc Khoan Nhồi D1000 (Tam Giác Đều)
* **Ngữ cảnh thực tế:** Tổ hợp căn hộ & văn phòng 30 tầng + 2 tầng hầm phổ biến tại Hà Nội (Cầu Giấy, Thanh Xuân) và TP.HCM (Quận 7, Thủ Đức). Sử dụng 3 cọc khoan nhồi $D_p = 1000\text{ mm}$ bố trí theo tam giác đều cạnh $S = 3D_p = 3000\text{ mm}$.
* **Đặc điểm kỹ thuật:** Đây là bài toán 3D Strut-and-Tie không đối xứng trục $Y$ kinh điển. Cọc đỉnh $P_1$ nằm trên trục $Y$ chịu lực bứt tách hoàn toàn theo phương $Y$, trong khi 2 cọc đáy $P_2, P_3$ phân tách lực theo cả hai phương $X$ và $Y$ với góc xoay mặt bằng $\alpha = 30^\circ$.
* **Thông số chuẩn:**
  * Bê tông: `B35` ($f_{cd} = 19.5\text{ MPa}$), Thép: `CB400-V` ($f_{yd} = 350\text{ MPa}$).
  * Cột vuông: $b_c = 1000\text{ mm}, h_c = 1000\text{ mm}$.
  * Kích thước bao đài: $L_x = 5000\text{ mm}, L_y = 4600\text{ mm}, h = 2100\text{ mm}, c = 200\text{ mm}$.
  * Tọa độ 3 cọc $D_p = 1000\text{ mm}$ (Trọng tâm nhóm cọc tại $(0,0)$):
    * `P1`: $(0, +1732)\text{ mm}$
    * `P2`: $(-1500, -866)\text{ mm}$
    * `P3`: $(+1500, -866)\text{ mm}$
  * Nội lực chân cột: $N_{Ed} = 19500\text{ kN}, M_{Ed,x} = 850\text{ kN}\cdot\text{m}, M_{Ed,y} = 600\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `5 lớp`, `4 nhánh X + 4 nhánh Y`, đường kính `Ø18`.

#### 3. `VN_PRESET_03`: Tháp Phức hợp 35–40 tầng — Đài 4 Cọc Khoan Nhồi D1200 Tải Lớn
* **Ngữ cảnh thực tế:** Cột nội (Interior Column) chịu tải trọng lớn trong các tòa tháp 38 tầng + 3–4 tầng hầm. Cọc khoan nhồi $D_p = 1200\text{ mm}$ tựa vào tầng cuội sỏi hoặc đá phong hóa, sức chịu tải tính toán mỗi cọc lên tới $900\text{--}1050\text{ tấn}$.
* **Đặc điểm kỹ thuật:** Lực nén dọc trục trong mỗi thanh chống $F_{c,i}$ vượt ngưỡng $12,000\text{ kN}$, sinh ra lực kéo bứt tách ngang khổng lồ đòi hỏi lồng thép chống bứt tách nhiều lớp đường kính lớn ($\phi 20\text{--}\phi 22$).
* **Thông số chuẩn:**
  * Bê tông: `B40` ($f_{cd} = 22.0\text{ MPa}$), Thép: `CB500-V` ($f_{yd} = 435\text{ MPa}$).
  * Cột: $b_c = 1200\text{ mm}, h_c = 1400\text{ mm}$.
  * Kích thước đài: $L_x = 6000\text{ mm}, L_y = 6000\text{ mm}, h = 2600\text{ mm}, c = 220\text{ mm}$.
  * Cọc tròn $D_p = 1200\text{ mm}$, khoảng cách $3D_p = 3600\text{ mm} \implies 4$ cọc tại $(\pm 1800, \pm 1800)\text{ mm}$.
  * Nội lực chân cột: $N_{Ed} = 36000\text{ kN}, M_{Ed,x} = 1600\text{ kN}\cdot\text{m}, M_{Ed,y} = 1400\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `6 lớp`, `6 nhánh X + 6 nhánh Y`, đường kính `Ø20`.

#### 4. `VN_PRESET_04`: Đài 2 Cọc Khoan Nhồi D1000 Dưới Cột Biên / Cột Vách Cứng
* **Ngữ cảnh thực tế:** Đài 2 cọc dưới cột biên hoặc cánh vách cứng trong nhà cao tầng 25–30 tầng.
* **Đặc điểm kỹ thuật:** Toàn bộ truyền lực diễn ra trong mặt phẳng đứng $X\text{--}Z$ ($e_y = 0 \implies T_{burst,Y} = 0$ theo lý thuyết, nhưng vẫn cần bố trí cốt thép cấu tạo theo phương $Y$ để ôm lồng). Giúp kỹ sư kiểm chứng trực quan mô hình thanh chống hình chai 2D kinh điển.
* **Thông số chuẩn:**
  * Bê tông: `B35` ($f_{cd} = 19.5\text{ MPa}$), Thép: `CB400-V` ($f_{yd} = 350\text{ MPa}$).
  * Cột vách: $b_c = 600\text{ mm}, h_c = 1500\text{ mm}$.
  * Kích thước đài: $L_x = 5000\text{ mm}, L_y = 2200\text{ mm}, h = 2000\text{ mm}, c = 200\text{ mm}$.
  * Cọc tròn $D_p = 1000\text{ mm}$ tại $(\pm 1500, 0)\text{ mm}$.
  * Nội lực chân cột: $N_{Ed} = 13500\text{ kN}, M_{Ed,x} = 0\text{ kN}\cdot\text{m}, M_{Ed,y} = 1100\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `5 lớp`, `4 nhánh X + 2 nhánh Y`, đường kính `Ø16`.

#### 5. `VN_PRESET_05`: Tháp Điểm Nhấn 45+ Tầng — Đài 6 Cọc Khoan Nhồi D1200 Dưới Cột Mega
* **Ngữ cảnh thực tế:** Trụ Mega hoặc trụ biên lõi cứng của tòa tháp 45 tầng. Bố trí 6 cọc khoan nhồi $D_p = 1200\text{ mm}$ theo lưới $3 \times 2$.
* **Đặc điểm kỹ thuật (Case Study "Bẫy Thiết Kế"):**
  * 2 cọc giữa tại $(0, \pm 1800)$ nằm gần cột nên có góc nghiêng thanh chống rất dốc ($\theta \approx 58^\circ$).
  * Ngược lại, 4 cọc góc tại $(\pm 3600, \pm 1800)$ nằm xa cột nên thanh chống đi rất thoải ($\theta \approx 34^\circ$), làm lực nén thanh chống và lực kéo bứt tách phương $X$ tăng vọt! Mẫu này được cố tình thiết kế ở trạng thái **Cảnh báo đỏ (Không đạt ở cấu hình ban đầu)** để kỹ sư bấm nút **Auto-Fix** và thấy ngay hiệu quả tối ưu.
* **Thông số chuẩn:**
  * Bê tông: `B40` ($f_{cd} = 22.0\text{ MPa}$), Thép: `CB500-V` ($f_{yd} = 435\text{ MPa}$).
  * Cột Mega: $b_c = 1600\text{ mm}, h_c = 1200\text{ mm}$.
  * Kích thước đài: $L_x = 9600\text{ mm}, L_y = 6000\text{ mm}, h = 2800\text{ mm}, c = 250\text{ mm}$.
  * 6 cọc $D_p = 1200\text{ mm}$ tại: $(-3600, \pm 1800), (0, \pm 1800), (+3600, \pm 1800)\text{ mm}$.
  * Nội lực chân cột: $N_{Ed} = 50000\text{ kN}, M_{Ed,x} = 2500\text{ kN}\cdot\text{m}, M_{Ed,y} = 4200\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `6 lớp`, `6 nhánh X + 6 nhánh Y`, đường kính `Ø20` (Sẽ báo thiếu thép phương $X$ để kích hoạt Auto-Fix).

#### 6. `VN_PRESET_06`: Nhà Cao Tầng Xen Cấy Đô Thị 18 Tầng — Đài 4 Cọc Lệch Tâm Sát Tường Vây
* **Ngữ cảnh thực tế:** Công trình khách sạn / văn phòng 18 tầng xây chen trong nội đô (Quận 1, Quận 3, Hoàn Kiếm, Hai Bà Trưng). Cột biên nằm lệch sát mép tường vây ranh đất, gây mô men lệch tâm lớn và làm các thanh chống bên phải dốc đứng trong khi các thanh chống bên trái vươn dài.
* **Thông số chuẩn:**
  * Bê tông: `B35` ($f_{cd} = 19.5\text{ MPa}$), Thép: `CB400-V` ($f_{yd} = 350\text{ MPa}$).
  * Cột biên: $b_c = 800\text{ mm}, h_c = 800\text{ mm}$ (Gốc tọa độ $(0,0)$ tại tâm cột).
  * Kích thước đài: $L_x = 4200\text{ mm}, L_y = 3800\text{ mm}, h = 1900\text{ mm}, c = 180\text{ mm}$.
  * 4 cọc khoan nhồi $D_p = 800\text{ mm}$ bố trí lệch tâm về phía trong công trình (phía $+X$):
    * `P1`: $(-600, +1200)\text{ mm}$, `P2`: $(-600, -1200)\text{ mm}$
    * `P3`: $(+1800, +1200)\text{ mm}$, `P4`: $(+1800, -1200)\text{ mm}$
  * Nội lực chân cột: $N_{Ed} = 12800\text{ kN}, M_{Ed,x} = 400\text{ kN}\cdot\text{m}, M_{Ed,y} = 2800\text{ kN}\cdot\text{m}$.
  * Thép chống bứt tách mặc định: `4 lớp`, `4 nhánh X + 4 nhánh Y`, đường kính `Ø16`.

---

## PHẦN 3: TINH CHỈNH UI/UX "GÂY NGHIỆN" CHO KỸ SƯ KẾT CẤU (STRUCTURAL ENGINEER EXPERIENCE)

### 3.1. Giao Diện "CAD / CAE Blueprint Dark Mode"

Kỹ sư kết cấu làm việc hàng giờ liền với AutoCAD, ETABS, SAFE và Revit. Giao diện ứng dụng cần mang lại cảm giác của một phần mềm CAE chuyên nghiệp, độ tương phản cao, không gây mỏi mắt:

* **Nền chính (Workspace Background):** Slate-950 (`#090D16`) kết hợp lưới tọa độ kỹ thuật mờ (`radial-gradient` hoặc `linear-gradient` 1px với độ mờ `4%`).
* **Bảng điều khiển (Panels & Cards):** Nền `#111827` (Slate-900) với viền mảnh `1px solid #1E293B` (Slate-800).
* **Font chữ:**
  * Tiêu đề & Nhãn: `Inter` hoặc `Plus Jakarta Sans`.
  * Toàn bộ con số, tọa độ, ứng suất, diện tích thép, đơn giá: **Bắt buộc dùng font Monospace (`JetBrains Mono` hoặc `Fira Code`)** với thuộc tính `tabular-nums` để khi kéo thanh trượt, các con số nhảy mượt mà không bị giật ngang khung hình.
* **Bảng màu ngữ nghĩa kỹ thuật (Semantic Engineering Colors):**
  * **Nén / Thanh chống (Compression Strut):** Hổ phách / Cam (`#F59E0B` $\rightarrow$ `#EA580C`).
  * **Kéo / Thanh giằng & Lồng thép (Tension Tie & Rebar):** Xanh Cyan / Xanh kỹ thuật (`#06B6D4` & `#3B82F6`).
  * **An toàn ($UR \le 0.85$):** Xanh lục Emerald (`#10B981`).
  * **Tiệm cận giới hạn ($0.85 < UR \le 1.00$):** Vàng Amber (`#FBBF24`).
  * **Phá hoại / Quá tải ($UR > 1.00$ hoặc $\theta < 25^\circ$):** Đỏ Crimson (`#EF4444`) kèm hiệu ứng viền phát sáng nhẹ (`box-shadow: 0 0 12px rgba(239,68,68,0.35)`).

---

### 3.2. Hệ Thống Phím Tắt Kỹ Thuật Chuẩn CAD (Engineering Hotkeys)

Cài đặt một `window.addEventListener('keydown', ...)` (tự động bỏ qua khi con trỏ đang focus trong ô `<input>`) và hiển thị thanh nhắc phím tắt nhỏ gọn ở chân màn hình (Status Bar):

| Phím tắt | Chức năng tức thời | Phản hồi thị giác |
| :---: | :--- | :--- |
| `1` / `2` / `3` / `4` | Chuyển góc nhìn Camera: `3D Iso` / `Mặt bằng (Top)` / `Mặt đứng X` / `Mặt đứng Y` | Camera bay mượt (Smooth Lerp) về góc chiếu |
| `X` | Bật / Tắt lớp vỏ bê tông X-Ray | Làm rõ hoặc ẩn khối bê tông đài |
| `B` | Bật / Tắt vỏ phình hình chai (Bottle-shaped Bulge) | Hiển thị vùng phình ứng suất $b_{spread}$ |
| `R` | Bật / Tắt Lồng cốt thép chống bứt tách 3D | Ẩn/hiện toàn bộ các lớp thép ngang |
| `[` và `]` | Giảm / Tăng đường kính thép $\phi$ theo dãy chuẩn ($12 \leftrightarrow 14 \leftrightarrow 16 \leftrightarrow 18 \leftrightarrow 20 \leftrightarrow 22 \leftrightarrow 25$) | Cập nhật ngay lập tức $A_{s,prov}$, $UR$ và độ dày thanh 3D |
| `-` và `=` | Giảm / Tăng số lớp thép chống bứt tách (`numLayers`) | Thêm/bớt lớp lưới thép trực tiếp trên 3D |
| `Shift + ↑` / `Shift + ↓` | Tăng / Giảm chiều cao đài $h$ từng nấc $\pm 50\text{ mm}$ | Mô hình 3D cao lên/thấp xuống theo thời gian thực, góc $\theta_i$ và biểu đồ lực tự động co giãn |
| `A` | Kích hoạt nhanh cửa sổ **⚡ Auto-Fix & Cost Optimizer** | Mở bảng 3 kịch bản tối ưu chi phí |

---

### 3.3. Tính Năng "Ghost Preview" Khi Rê Chuột Qua Phương Án Auto-Fix

Đây là chi tiết UX tạo cảm giác "ma thuật" cho người dùng:
* Khi cửa sổ **Auto-Fix & Cost Optimization** đang hiển thị 3 thẻ kịch bản (`Chỉ sửa thép`, `Nâng mác bê tông`, `Tối ưu tổng chi phí`), nếu kỹ sư **rê chuột (hover)** lên bất kỳ thẻ nào:
  * Mô hình 3D ở giữa màn hình và các thanh trạng thái $UR$ bên phải lập tức **hiển thị xem trước (Live Preview)** cấu hình của kịch bản đó (kèm nhãn nhấp nháy `"ĐANG XEM TRƯỚC KỊCH BẢN TỐI ƯU"`).
  * Các thanh tiến trình $UR$ hiển thị song song vạch cũ (mờ) và vạch mới (sáng) để kỹ sư thấy ngay mức độ cải thiện.
  * Khi click nút **`[Áp dụng phương án này]`**, thông số chính thức được ghi nhận kèm thông báo xác nhận số tiền và khối lượng thép đã tiết kiệm được.

---

### 3.4. Thước Đo Khả Năng Thi Công & Đút Lọt Đầm Dùi (Constructability & Vibrator Clearance Gauge)

Kỹ sư thiết kế rất sợ bị công trường phản hồi là *"thép đặt dày quá không đút được vòi đầm dùi $\varnothing 60$ hoặc đá $1\times 2$ bị kẹt"*.
* Bổ sung một widget nhỏ mang tên **"Kiểm tra Thi công & Đổ bê tông (Constructability Check)"** ngay dưới phần chọn thép:
  * Tính khoảng hở thông thủy đứng: $s_{clear,v} = s_v - \phi$.
  * Tính khoảng hở thông thủy ngang nhỏ nhất giữa các nhánh: $s_{clear,h} = \min(s_{clear,X}, s_{clear,Y})$.
  * Hiển thị biểu tượng đầu đầm dùi bê tông ($\varnothing 50\text{ mm}$ / $\varnothing 70\text{ mm}$) so sánh trực tiếp với ô lưới thép:
    * Nếu $s_{clear,v} \ge 120\text{ mm}$ và $s_{clear,h} \ge 150\text{ mm}$: Báo **Xanh lá — "Thông thoáng, dễ đầm bê tông"**.
    * Nếu $100\text{ mm} \le s_{clear,v} < 120\text{ mm}$: Báo **Vàng — "Mật độ thép khá dày, lưu ý khi đầm dùi"**.
    * Nếu $s_{clear,v} < 100\text{ mm}$ hoặc $s_{clear,h} < 100\text{ mm}$: Báo **Đỏ — "Quá dày! Nguy cơ rỗng bê tông — Hãy giảm số lớp và tăng đường kính $\phi$"**.