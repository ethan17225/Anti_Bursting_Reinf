# TECHNICAL SPECIFICATION: PILE CAP ANTI-BURSTING REINFORCEMENT DESIGN TOOL

## 1. Mục tiêu dự án (System Prompt cho AI Agent)

Bạn là một Senior Structural Software Engineer. Nhiệm vụ của bạn là xây dựng một ứng dụng Web (Single Page Application) tính toán và bố trí cốt thép chống bứt tách (anti-bursting / splitting reinforcement) cho đài cọc bê tông cốt thép theo mô hình Giàn ảo không gian 3 chiều (3D Strut-and-Tie Model - STM), tuân thủ tiêu chuẩn **Eurocode 2 (EN 1992-1-1)**, **TCVN 5574:2018** và **ACI 318-19**.

### Yêu cầu kiến trúc kỹ thuật:

* **Frontend Framework:** React 18+ (TypeScript) + Tailwind CSS + Lucide Icons.

* **3D & 2D Visualization:**

  * Không gian 3D tương tác: `three`, `@types/three`, `@react-three/fiber` (R3F), `@react-three/drei`.

  * Mặt cắt chi tiết 2D: HTML5 SVG chuẩn tỷ lệ phục vụ in ấn thuyết minh.

* **Kiến trúc code:** Tách biệt hoàn toàn phần lõi toán học (`src/core/calculationEngine.ts`), bộ dựng hình 3D (`src/components/viewer3d/PileCapScene3D.tsx`) và giao diện điều khiển để dễ dàng bảo trì và chạy Unit Test.

## 2. Cấu trúc dữ liệu chuẩn (Data Interfaces)

```
export interface MaterialInput {
  standard: 'EC2' | 'TCVN_5574_2018' | 'ACI_318_19';
  fck: number;       // Cường độ chịu nén đặc trưng của bê tông (MPa), hoặc B-grade
  fcd: number;       // Cường độ chịu nén tính toán của bê tông (MPa)
  fyk: number;       // Cường độ chảy đặc trưng của cốt thép (MPa)
  fyd: number;       // Cường độ chịu kéo tính toán của cốt thép chống bứt tách (MPa)
}

export interface GeometryInput {
  Lx: number;        // Chiều dài đài cọc phương X (mm)
  Ly: number;        // Chiều rộng đài cọc phương Y (mm)
  h: number;         // Chiều cao tổng của đài cọc (mm)
  c: number;         // Lớp bê tông bảo vệ đến trọng tâm thép chủ đáy đài (mm)
  bc: number;        // Kích thước cột phương X (mm)
  hc: number;        // Kích thước cột phương Y (mm)
  Dp: number;        // Đường kính cọc tròn hoặc cạnh cọc vuông (mm)
  pileShape: 'CIRCULAR' | 'SQUARE';
  piles: Array<{ id: number; x: number; y: number }>; // Tọa độ cọc so với tâm cột (0,0) (mm)
}

export interface LoadInput {
  NEd: number;       // Lực dọc tính toán tại chân cột (kN) - quy ước nén dương (+)
  MEdx: number;      // Mô men uốn quanh trục X (kN.m)
  MEdy: number;      // Mô men uốn quanh trục Y (kN.m)
  includeSelfWeight: boolean; // Có kể trọng lượng bản thân đài hay không
}

export interface DetailingInput {
  barDiameter: number;   // Đường kính thanh thép ngang chống bứt tách phi (mm)
  numLayers: number;     // Số lớp lưới/vòng đai bố trí theo chiều cao vùng truyền lực
  legsPerLayerX: number; // Số nhánh thép cắt qua mặt phẳng bứt tách theo phương X
  legsPerLayerY: number; // Số nhánh thép cắt qua mặt phẳng bứt tách theo phương Y
}

export interface Viewer3DConfig {
  showConcreteShell: boolean;   // Hiển thị khối bê tông đài, cột, cọc dạng X-Ray
  showStrutAndTie: boolean;     // Hiển thị thanh chống nén (Struts) và thanh giằng đáy (Ties)
  showBottleBulge: boolean;     // Hiển thị vùng phình hình chai (Bottle-shaped dispersion zone)
  showBurstingArrows: boolean;  // Hiển thị vector lực kéo bứt tách ngang T_burst
  showRebarCage: boolean;       // Hiển thị các lớp lưới thép chống bứt tách 3D
  showLabels: boolean;          // Hiển thị nhãn thông số nổi (<Html> badges)
  cameraMode: 'PERSPECTIVE' | 'ORTHO_TOP' | 'ORTHO_FRONT' | 'ORTHO_SIDE';
  selectedPileId: number | null; // Làm nổi bật (highlight) nhánh thanh chống của cọc đang chọn
}

```

## 3. Chi tiết Thuật toán Tính toán (Core Mathematical Algorithm)

AI Agent cần hiện thực hóa chính xác 6 bước tính toán tuần tự dưới đây:

### Bước 1: Tính toán chiều cao làm việc & Phản lực đầu cọc (Pile Reactions)

1. **Chiều cao làm việc hữu hiệu của đài cọc (**$d$**):**

   $$
   d = h - c
   $$

2. **Cánh tay đòn nội lực của giàn ảo (**$z$**):**

   $$
   z = 0.85 \cdot d
   $$

3. **Phân phối lực dọc xuống từng cọc** $i$ **(**$i = 1 \dots n$**) theo giả thiết đài tuyệt đối cứng:**

   * Trọng lượng bản thân đài truyền thẳng xuống cọc mà không đi qua thanh chống xiên từ chân cột, nên chỉ dùng để kiểm tra sức chịu tải cọc, **không** cộng vào lực nén thanh chống:

     $$
     R_i = \frac{N_{Ed}}{n} + \frac{M_{Ed,x} \cdot 10^3 \cdot y_i}{\sum_{j=1}^n y_j^2} + \frac{M_{Ed,y} \cdot 10^3 \cdot x_i}{\sum_{j=1}^n x_j^2}
     $$

   * Trong đó: $R_i$ tính bằng $\text{kN}$; $x_i, y_i$ tính bằng $\text{mm}$; $M_{Ed,x}, M_{Ed,y}$ tính bằng $\text{kN}\cdot\text{m}$.

   * Lọc các cọc chịu nén ($R_i > 0$). Các cọc có $R_i \le 0$ không hình thành thanh chống nén (strut).

### Bước 2: Giải hình học không gian 3D của Thanh chống (3D Strut Geometry)

Mỗi cọc chịu nén $i$ nhận lực truyền từ một vùng nút con (sub-node) tại đáy cột đến tâm đầu cọc:

1. **Tọa độ tâm vùng nút con tại chân cột** $(x_{c,i}, y_{c,i})$**:**
   Chia tiết diện cột thành các phần tư tương ứng với góc phần tư chứa cọc $i$:

   $$
   x_{c,i} = \text{sign}(x_i) \cdot \frac{b_c}{4}, \quad y_{c,i} = \text{sign}(y_i) \cdot \frac{h_c}{4}
   $$

   *(Lưu ý: Nếu* $x_i = 0$ *thì* $x_{c,i} = 0$*; nếu* $y_i = 0$ *thì* $y_{c,i} = 0$*).*

2. **Khoảng cách hình chiếu bằng từ vùng nút cột đến tâm cọc** $i$**:**

   $$
   e_{x,i} = \lvert x_i - x_{c,i} \rvert, \quad e_{y,i} = \lvert y_i - y_{c,i} \rvert
   $$

   $$
   a_i = \sqrt{e_{x,i}^2 + e_{y,i}^2}
   $$

3. **Kiểm tra điều kiện đài cứng (Vùng D - Discontinuity Region):**

   * Nếu $a_i \le 2.0 \cdot d$: Đài làm việc theo mô hình Giàn ảo (Strut-and-Tie), bắt buộc tính cốt thép chống bứt tách.

   * Nếu $a_i > 2.0 \cdot d$: Cảnh báo người dùng đài cọc thuộc dạng đài mềm (tính theo lý thuyết dầm chịu uốn và chọc thủng thông thường).

4. **Chiều dài không gian của thanh chống** $i$ **(**$L_{s,i}$**) và các góc định hướng:**

   $$
   L_{s,i} = \sqrt{a_i^2 + z^2}
   $$

   * Góc nghiêng $\theta_i$ của thanh chống so với mặt phẳng nằm ngang:

     $$
     \sin \theta_i = \frac{z}{L_{s,i}}, \quad \cos \theta_i = \frac{a_i}{L_{s,i}}, \quad \theta_i = \arcsin\left(\frac{z}{L_{s,i}}\right) \cdot \frac{180}{\pi}
     $$

   * **Ràng buộc giới hạn góc** $\theta_i$**:** Nếu $\theta_i < 25^\circ$, hệ thống phải hiển thị cảnh báo đỏ: *"Góc nghiêng thanh chống quá thoải (*$\theta_i < 25^\circ$*), cần tăng chiều cao đài* $h$*"*.

   * Góc xoay trên mặt bằng $\alpha_i$ của thanh chống so với trục $X$:

     $$
     \cos \alpha_i = \frac{e_{x,i}}{a_i}, \quad \sin \alpha_i = \frac{e_{y,i}}{a_i}
     $$

5. **Lực nén dọc trục trong thanh chống bê tông** $i$ **(**$F_{c,i}$**) và lực kéo thanh giằng chính (**$T_{main,i}$**):**

   $$
   F_{c,i} = \frac{R_i}{\sin \theta_i} \quad (\text{kN})
   $$

   $$
   T_{main,i} = R_i \cdot \cot \theta_i = R_i \cdot \frac{a_i}{z} \quad (\text{kN})
   $$

### Bước 3: Kiểm tra điều kiện chống ép vỡ bê tông (Concrete Strut Crushing Check)

Trước khi tính thép chống bứt tách, phải đảm bảo bản thân bê tông không bị vỡ do ứng suất nén vượt giới hạn:

1. **Hệ số chiết giảm cường độ bê tông bị nứt (**$\nu'$**):**

   $$
   \nu' = 1 - \frac{f_{ck}}{250}
   $$

2. **Ứng suất nén giới hạn cho phép trong thanh chống chịu kéo ngang (**$\sigma_{Rd,max}$**):**

   $$
   \sigma_{Rd,max} = 0.6 \cdot \nu' \cdot f_{cd} \quad (\text{MPa})
   $$

3. **Diện tích tiết diện cọc (**$A_p$**) và diện tích mặt cắt ngang thanh chống tại đầu cọc (**$A_{strut,i}$**):**

   * Cọc tròn: $A_p = \frac{\pi \cdot D_p^2}{4}$

   * Cọc vuông: $A_p = D_p^2$

   * Tiết diện thanh chống vuông góc trục:

     $$
     A_{strut,i} = A_p \cdot \sin \theta_i \quad (\text{mm}^2)
     $$

4. **Ứng suất nén thực tế trong thanh chống (**$\sigma_{c,strut,i}$**):**

   $$
   \sigma_{c,strut,i} = \frac{F_{c,i} \cdot 10^3}{A_{strut,i}} = \frac{R_i \cdot 10^3}{A_p \cdot \sin^2 \theta_i} \quad (\text{MPa})
   $$

   * **Điều kiện kiểm tra:** $\sigma_{c,strut,i} \le \sigma_{Rd,max}$. Nếu vượt quá, báo lỗi `"CRUSHING_FAILURE"` và yêu cầu tăng mác bê tông hoặc tăng chiều cao đài $h$.

### Bước 4: Tính Lực Kéo Ngang Gây Bứt Tách (Transverse Bursting Force)

Áp dụng mô hình thanh chống hình chai (Bottle-shaped Strut) theo **Eurocode 2 (Mục 6.5.3)** và **TCVN 5574:2018**:

1. **Bề rộng truyền lực hữu hiệu của thanh chống tại đầu cọc (**$b_{ef,i}$**):**

   $$
   b_{ef,i} = D_p \cdot \sin \theta_i \quad (\text{mm})
   $$

2. **Chiều dài vùng phân tán ứng suất (**$H_{ef,i}$**) và bề rộng phình tối đa (**$b_{spread,i}$**):**

   $$
   H_{ef,i} = \frac{L_{s,i}}{2} \quad (\text{mm})
   $$

   $$
   b_{spread,i} = b_{ef,i} + 0.5 \cdot H_{ef,i} \quad (\text{mm})
   $$

3. **Lực kéo bứt tách vuông góc với trục thanh chống (**$T_{burst,\perp,i}$**):**

   * **Nếu chọn tiêu chuẩn `EC2` hoặc `TCVN_5574_2018`:**

     * Trường hợp gián đoạn một phần ($b_{ef,i} \le \frac{H_{ef,i}}{2}$):

       $$
       T_{burst,\perp,i} = 0.25 \cdot \left(\frac{b_{spread,i} - b_{ef,i}}{b_{spread,i}}\right) \cdot F_{c,i} \quad (\text{kN})
       $$

     * Trường hợp gián đoạn toàn phần ($b_{ef,i} > \frac{H_{ef,i}}{2}$):

       $$
       T_{burst,\perp,i} = 0.25 \cdot \left(1 - 0.7 \cdot \frac{b_{ef,i}}{H_{ef,i}}\right) \cdot F_{c,i} \quad (\text{kN})
       $$

   * **Nếu chọn tiêu chuẩn `ACI_318_19` (Mục 23.5 - Thanh chống hình chai với độ mở rộng** $2:1$**):**

     $$
     T_{burst,\perp,i} = 0.25 \cdot F_{c,i} \quad (\text{kN})
     $$

### Bước 5: Quy Đổi Lực Bứt Tách Không Gian 3D Về Hệ Cốt Thép Ngang Trực Giao (X, Y)

Vì ngoài công trường không thể đặt cốt thép đai vuông góc với từng thanh chống xiên 3D, cốt thép chống bứt tách được đặt thành **các lớp lưới/đai nằm ngang** phân bố đều theo chiều cao vùng truyền lực $z$ theo hai phương trực giao $X$ và $Y$:

1. **Quy đổi từ phương vuông góc trục thanh chống về mặt phẳng nằm ngang:**
   Do cốt thép nằm ngang tạo với trục thanh chống (cũng là phương vết nứt chéo) một góc bằng $\theta_i$, thành phần lực ngang hiệu dụng cần thiết cho cọc $i$ là:

   $$
   T_{burst,h,i} = \frac{T_{burst,\perp,i}}{\sin \theta_i} \quad (\text{kN})
   $$

2. **Chiếu lực kéo ngang của thanh chống** $i$ **lên hai phương trục** $X$ **và** $Y$**:**

   $$
   T_{burst,x,i} = T_{burst,h,i} \cdot \cos \alpha_i = T_{burst,h,i} \cdot \frac{e_{x,i}}{a_i} \quad (\text{kN})
   $$

   $$
   T_{burst,y,i} = T_{burst,h,i} \cdot \sin \alpha_i = T_{burst,h,i} \cdot \frac{e_{y,i}}{a_i} \quad (\text{kN})
   $$

3. **Tổng hợp lực bứt tách thiết kế qua mặt cắt ngang đài cọc:**
   Khi các thanh thép ngang chạy liên tục qua chiều dài và chiều rộng đài cọc, lực kéo thiết kế trên mặt cắt đứng qua tâm cột theo phương $X$ và $Y$ được lấy bằng tổng lực lớn nhất giữa hai phía đối diện qua trục cột:

   $$
   T_{design,X} = \max\left( \sum_{x_i \ge 0} T_{burst,x,i}, \sum_{x_i < 0} T_{burst,x,i} \right) \quad (\text{kN})
   $$

   $$
   T_{design,Y} = \max\left( \sum_{y_i \ge 0} T_{burst,y,i}, \sum_{y_i < 0} T_{burst,y,i} \right) \quad (\text{kN})
   $$

4. **Diện tích cốt thép chống bứt tách yêu cầu (**$A_{s,burst,req}$**):**

   $$
   A_{s,burst,X,req} = \frac{T_{design,X} \cdot 10^3}{f_{yd}} \quad (\text{mm}^2)
   $$

   $$
   A_{s,burst,Y,req} = \frac{T_{design,Y} \cdot 10^3}{f_{yd}} \quad (\text{mm}^2)
   $$

### Bước 6: Thuật Toán Bố Trí Thép Thực Tế & Kiểm Tra Cấu Tạo (Smart Detailing)

1. **Chiều cao vùng đặt thép chống bứt tách (**$z_{burst}$**):**

   $$
   z_{burst} = 0.8 \cdot z \quad (\text{mm})
   $$

2. **Khoảng cách đứng giữa các lớp thép (**$s_v$**):**

   $$
   s_v = \frac{z_{burst}}{\text{numLayers} - 1} \quad (\text{mm})
   $$

   * Kiểm tra điều kiện cấu tạo: $100\text{ mm} \le s_v \le 300\text{ mm}$.

3. **Diện tích cốt thép cung cấp (**$A_{s,prov}$**):**

   * Diện tích 1 thanh thép đường kính $\phi$:

     $$
     a_{s1} = \frac{\pi \cdot \phi^2}{4} \quad (\text{mm}^2)
     $$

   * Tổng diện tích thép ngang cung cấp theo phương $X$ và $Y$:

     $$
     A_{s,burst,X,prov} = \text{numLayers} \cdot \text{legsPerLayerX} \cdot a_{s1} \quad (\text{mm}^2)
     $$

     $$
     A_{s,burst,Y,prov} = \text{numLayers} \cdot \text{legsPerLayerY} \cdot a_{s1} \quad (\text{mm}^2)
     $$

4. **Hệ số sử dụng khả năng chịu lực (Utilization Ratio -** $UR$**):**

   $$
   UR_X = \frac{A_{s,burst,X,req}}{A_{s,burst,X,prov}}, \quad UR_Y = \frac{A_{s,burst,Y,req}}{A_{s,burst,Y,prov}}
   $$

   * Đạt khi $\max(UR_X, UR_Y) \le 1.0$.

## 4. Đặc Tả Kỹ Thuật Module 3D Visualization (React Three Fiber & `@react-three/drei`)

AI Agent phải tuân thủ nghiêm ngặt các quy tắc toán học 3D dưới đây để tránh lỗi ngược trục hoặc che khuất vật thể trong suốt (transparency sorting issues).

### 4.1. Quy ước Ánh xạ Hệ Trục Tọa Độ & Đơn Vị (Coordinate Mapping)

Trong kỹ thuật kết cấu, mặt bằng là $(X, Y)$ và chiều cao là $Z$ hướng lên. Trong Three.js, mặt phẳng ngang mặc định là $(X, Z)$ và trục thẳng đứng là $Y$.
Để tránh nhầm lẫn, phải viết một hàm chuyển đổi duy nhất `to3D(x_mm, y_mm, z_mm)` đổi từ đơn vị $\text{mm}$ sang $\text{m}$ (nhân $0.001$) và ánh xạ như sau:

$$
\begin{bmatrix} X_{3D} \\ Y_{3D} \\ Z_{3D} \end{bmatrix} = 0.001 \cdot \begin{bmatrix} x_{struct} \\ z_{struct} \\ -y_{struct} \end{bmatrix}
$$

* **Mốc cao độ chuẩn (**$z_{struct}$**):**

  * Đáy đài cọc: $z_{struct} = 0\text{ mm}$

  * Mặt phẳng trọng tâm cốt thép chủ chịu kéo đáy đài (Tie plane): $z_{struct} = c$

  * Mặt phẳng nút chân cột (Column Nodal Zone plane): $z_{struct} = c + z$

  * Mặt đỉnh đài cọc: $z_{struct} = h$

  * Đỉnh đoạn cột chờ: $z_{struct} = h + 800\text{ mm}$

  * Đáy đoạn cọc chờ: $z_{struct} = -1000\text{ mm}$

### 4.2. Cấu hình Vật liệu X-Ray (X-Ray Concrete Material)

Để nhìn xuyên thấu vào các thanh chống và lồng thép bên trong đài cọc mà không bị lỗi nhấp nháy mặt phẳng (Z-fighting / Depth occlusion), khối bê tông đài cọc, cột và cọc **bắt buộc** phải dùng cấu hình sau:

```
import { Edges } from '@react-three/drei';

// Bên trong Mesh của Đài cọc (Pile Cap Box):
<mesh position={[0, (h * 0.001) / 2, 0]} renderOrder={1}>
  <boxGeometry args={[Lx * 0.001, h * 0.001, Ly * 0.001]} />
  <meshPhysicalMaterial
    color="#94a3b8"
    transparent={true}
    opacity={0.16}
    depthWrite={false} // BẮT BUỘC = false để không che khuất Strut và Rebar bên trong
    roughness={0.2}
  />
  <Edges threshold={15} color="#334155" />
</mesh>

```

### 4.3. Thuật Toán Dựng Thanh Chống Hình Chai 3D (`BottleStrut3D`)

Không dùng phép xoay Euler thủ công vì rất dễ sai góc nghiêng không gian 3D. AI Agent **bắt buộc** sử dụng `THREE.Quaternion.setFromUnitVectors` để căn chỉnh trục của khối trụ theo đúng vector nối từ Nút Chân Cột đến Đầu Cọc:

1. **Điểm đầu và điểm cuối của thanh chống** $i$ **trong không gian Three.js:**

   * Điểm đầu (Nút chân cột): $\mathbf{P}_{start,i} = \text{to3D}(x_{c,i}, c + z, y_{c,i})$

   * Điểm cuối (Tâm cọc tại mặt phẳng thép chủ): $\mathbf{P}_{end,i} = \text{to3D}(x_i, c, y_i)$

   * Trung điểm thanh chống: $\mathbf{P}_{mid,i} = \frac{\mathbf{P}_{start,i} + \mathbf{P}_{end,i}}{2}$

2. **Vector chỉ phương và Quaternion xoay:**

   ```
   const dir = new THREE.Vector3().subVectors(P_end, P_start);
   const length = dir.length();
   const quaternion = new THREE.Quaternion().setFromUnitVectors(
     new THREE.Vector3(0, 1, 0), // Trục mặc định của CylinderGeometry trong Three.js
     dir.clone().normalize()
   );
   
   ```

3. **Hình học Thanh chống Hình Chai (Bi-Conical Bottle Geometry):**
   Mỗi thanh chống gồm 2 lớp hiển thị đồng tâm tại $\mathbf{P}_{mid,i}$ với góc xoay `quaternion`:

   * **Lõi thanh chống thẳng (Core Strut Cylinder):** Hình trụ bán kính $r_{core} = 0.5 \cdot b_{ef,i} \cdot 0.001$, chiều dài `length`. Màu sắc tự động đổi theo hệ số ép vỡ bê tông $UR_{crush,i} = \frac{\sigma_{c,strut,i}}{\sigma_{Rd,max}}$:

     * $UR_{crush,i} \le 0.75$: Màu cam an toàn (`#f97316`)

     * $0.75 < UR_{crush,i} \le 1.0$: Màu vàng cảnh báo (`#eab308`)

     * $UR_{crush,i} > 1.0$: Màu đỏ phá hoại (`#ef4444`)

   * **Vỏ phình hình chai (Bottle Dispersion Envelope - bật/tắt qua `showBottleBulge`):** Ghép từ 2 hình nón cụt (`cylinderGeometry`) nối đáy lớn tại trung điểm thanh chống:

     * Bán kính hai đầu: $r_{end} = 0.5 \cdot b_{ef,i} \cdot 0.001$

     * Bán kính phình giữa: $r_{mid} = 0.5 \cdot b_{spread,i} \cdot 0.001$

     * Vẽ dạng lưới bán trong suốt (`wireframe={true}` hoặc `opacity={0.28}`, màu `#fb923c`) để kỹ sư thấy rõ dòng ứng suất nén phình rộng ra ở giữa chiều cao đài.

### 4.4. Dựng Vector Lực Kéo Bứt Tách Ngang (`BurstingArrows3D`)

Tại trung điểm $\mathbf{P}_{mid,i}$ của mỗi thanh chống, vẽ 2 mũi tên đối xứng hướng ra ngoài vuông góc với trục thanh chống (nằm trong mặt phẳng thẳng đứng chứa thanh chống) để biểu diễn lực kéo bứt tách $T_{burst,\perp,i}$:

* Vector pháp tuyến nằm trong mặt phẳng đứng của thanh chống:

  $$
  \mathbf{n}_{burst,i} = \text{normalize}\left(\mathbf{dir}_i \times (\mathbf{dir}_i \times \mathbf{Y}_{up})\right)
  $$

* Sử dụng `<Cone>` và `<Cylinder>` của `@react-three/drei` màu đỏ tươi (`#dc2626`) hướng từ trung điểm thanh chống ra hai phía theo $\pm \mathbf{n}_{burst,i}$.

### 4.5. Dựng Lồng Cốt Thép Chống Bứt Tách 3D (`AntiBurstingCage3D`)

Hiển thị chính xác số lớp (`numLayers`), số nhánh phương $X$ (`legsPerLayerX`) và số nhánh phương $Y$ (`legsPerLayerY`) mà người dùng đang chọn trên thanh trượt:

1. **Tính cao độ** $z_{struct,k}$ **của từng lớp thép** $k \in \{0, \dots, \text{numLayers}-1\}$**:**

   * Vùng rải thép có chiều cao $z_{burst} = 0.8 \cdot z$, đặt đối xứng qua cao độ trung bình của thanh chống $z_{mid} = c + 0.5 \cdot z$:

     $$
     z_{bottom\_layer} = c + 0.1 \cdot z
     $$

     $$
     z_{struct,k} = z_{bottom\_layer} + k \cdot s_v
     $$

2. **Vẽ các nhánh thép ngang trên mỗi lớp** $k$**:**

   * Chiều dài phạm vi rải thép phương $X$: $L_{cage,X} = L_x - 2 \cdot c_{side}$ (với $c_{side} = 75\text{ mm}$).

   * Chiều rộng phạm vi rải thép phương $Y$: $L_{cage,Y} = L_y - 2 \cdot c_{side}$.

   * **Các nhánh chạy dọc phương** $X$ **(chịu lực** $T_{design,X}$**):** Vẽ `legsPerLayerX` thanh thép tròn đường kính $\phi \cdot 0.001$ chạy từ $-L_{cage,X}/2$ đến $+L_{cage,X}/2$, phân bố đều theo phương $Y$ trong phạm vi $L_{cage,Y}$. Tô màu xanh dương đậm (`#2563eb`).

   * **Các nhánh chạy dọc phương** $Y$ **(chịu lực** $T_{design,Y}$**):** Vẽ `legsPerLayerY` thanh thép tròn đường kính $\phi \cdot 0.001$ chạy từ $-L_{cage,Y}/2$ đến $+L_{cage,Y}/2$, phân bố đều theo phương $X$ trong phạm vi $L_{cage,X}$. Tô màu xanh ngọc (`#0891b2`).

   * Đai bao chu vi ngoài cùng ở mỗi lớp được nối kín thành vòng chữ nhật.

### 4.6. Nhãn Thông Số Tương Tác (`<Html>` Overlay & Camera Controls)

* Sử dụng `<Html distanceFactor={6} center>` từ `@react-three/drei` gắn tại trung điểm $\mathbf{P}_{mid,i}$ của từng thanh chống để hiển thị thẻ thông tin nhỏ gọn:

  * Tên cọc: `P1`, Góc nghiêng: $\theta_i^\circ$

  * Lực nén Strut: $F_{c,i}\text{ kN}$

  * Lực bứt tách: $T_{burst,\perp,i}\text{ kN}$

* Bổ sung thanh công cụ nổi góc trên bên phải Canvas 3D gồm:

  * Các nút bật/tắt nhanh: `[Khối bê tông]`, `[Thanh chống hình chai]`, `[Mũi tên T_burst]`, `[Lồng thép chống bứt tách]`, `[Nhãn 3D]`.

  * Các nút chuyển góc nhìn Camera tức thời: `[3D Iso]`, `[Mặt bằng (Top)]`, `[Mặt đứng X (Front)]`, `[Mặt đứng Y (Side)]`.

  * Tích hợp `<GizmoHelper alignment="bottom-right"><GizmoViewport /></GizmoHelper>` để hiển thị trục tọa độ định hướng chuẩn phần mềm CAD/CAE.

## 5. Yêu Cầu Thiết Kế Giao Diện Tổng Thể (3-Column Dashboard Layout)

1. **Cột Trái (28% width) - Bảng Nhập Liệu Nhanh (Smart Input Panel):**

   * **Thư viện mẫu đài (Quick Presets):** Nút chọn nhanh `Đài 2 cọc`, `Đài 3 cọc tam giác`, `Đài 4 cọc vuông`, `Đài 6 cọc chữ nhật`. Khi bấm vào tự động điền tọa độ $(x_i, y_i)$ theo khoảng cách cọc $3D_p$.

   * **Vật liệu & Tải trọng:** Chọn tiêu chuẩn (`EC2`, `TCVN 5574:2018`, `ACI 318-19`), chọn nhanh cấp độ bền bê tông (`B25`, `B30`, `B35`, `B40`) và nhóm thép (`CB300-V`, `CB400-V`, `CB500-V`).

   * **Chọn Thép Chống Bứt Tách (Interactive Sliders):**

     * Chọn đường kính $\phi \in \{10, 12, 14, 16, 18, 20, 22\}\text{ mm}$.

     * Chọn số lớp theo chiều cao (`2` đến `10` lớp).

     * Chọn số nhánh mỗi lớp phương $X$ và $Y$ (`2`, `4`, `6`, `8` nhánh).

2. **Cột Giữa (44% width) - Không Gian 3D R3F & Mặt Cắt Kỹ Thuật 2D:**

   * Chuyển đổi linh hoạt giữa Tab **Mô hình 3D Tương tác (R3F)** và Tab **Bản vẽ Mặt cắt 2D (SVG)** có đầy đủ đường kích thước (`dim lines`) chiều cao $h, d, z, z_{burst}, s_v$.

3. **Cột Phải (28% width) - Kết Quả Kiểm Tra & Xuất Thuyết Minh:**

   * **Thẻ trạng thái tổng (Status Cards):**

     * Kiểm tra góc nghiêng thanh chống $\theta_i$ (Badge Xanh/Đỏ).

     * Kiểm tra ép vỡ bê tông $\sigma_{c,strut} \le \sigma_{Rd,max}$ (Thanh tiến trình %).

     * Kiểm tra thép chống bứt tách phương $X$ và phương $Y$ ($A_{s,req}$ vs $A_{s,prov}$).

   * **Bảng chi tiết từng cọc (Per-Pile Breakdown Table):** Hiển thị $R_i$, $a_i$, $\theta_i$, $F_{c,i}$, $T_{burst,\perp,i}$, $T_{burst,x,i}$, $T_{burst,y,i}$. Click vào dòng của cọc nào sẽ tự động highlight thanh chống của cọc đó trong mô hình 3D.

   * **Nút "Xuất Thuyết Minh Chi Tiết (Print/PDF)":** Mở chế độ trang A4 trình bày đầy đủ công thức thay số từng bước để kỹ sư in nộp thẩm tra.

## 6. Bộ Dữ Liệu Kiểm Chứng Chuẩn (Benchmark Unit Test Case)

AI Agent **bắt buộc** phải viết một Unit Test hoặc chế độ tự kiểm tra với bộ thông số mặc định dưới đây và đảm bảo sai số kết quả $< 1\%$:

### Đầu vào (Default Inputs):

* **Tiêu chuẩn:** `TCVN_5574_2018` / `EC2`

* **Vật liệu:** $f_{ck} = 25\text{ MPa}$, $f_{cd} = 14.5\text{ MPa}$, $f_{yd} = 350\text{ MPa}$ (Thép CB400-V).

* **Hình học đài 4 cọc đối xứng:**

  * $L_x = 2700\text{ mm}$, $L_y = 2700\text{ mm}$, $h = 1500\text{ mm}$, $c = 150\text{ mm} \implies d = 1350\text{ mm}$.

  * Cột vuông: $b_c = 600\text{ mm}$, $h_c = 600\text{ mm}$.

  * Cọc tròn: $D_p = 600\text{ mm}$, tọa độ 4 cọc tại $(\pm 900, \pm 900)\text{ mm}$.

* **Tải trọng tại chân cột:** $N_{Ed} = 8000\text{ kN}$, $M_{Ed,x} = 0$, $M_{Ed,y} = 0$.

* **Bố trí thép:** Đường kính $\phi = 14\text{ mm}$ ($a_{s1} = 153.94\text{ mm}^2$), số lớp $\text{numLayers} = 4$, số nhánh $\text{legsPerLayerX} = \text{legsPerLayerY} = 4$.

### Kết quả đầu ra kỳ vọng (Expected Outputs):

 1. **Phản lực mỗi cọc:** $R_i = 2000.0\text{ kN}$.

 2. **Cánh tay đòn nội lực:** $z = 0.85 \times 1350 = 1147.5\text{ mm}$.

 3. **Tọa độ nút con chân cột:** $x_{c,i} = \pm 150\text{ mm}$, $y_{c,i} = \pm 150\text{ mm}$.

 4. **Khoảng cách trên mặt bằng:** $e_{x,i} = 750\text{ mm}$, $e_{y,i} = 750\text{ mm} \implies a_i = 1060.66\text{ mm}$.

 5. **Chiều dài thanh chống:** $L_{s,i} = \sqrt{1060.66^2 + 1147.5^2} = 1562.61\text{ mm}$.

 6. **Góc nghiêng thanh chống:** $\sin \theta_i = 0.73435$, $\theta_i = 47.25^\circ$ (Hợp lệ vì $\theta_i \ge 25^\circ$).

 7. **Lực nén trong mỗi thanh chống:** $F_{c,i} = \frac{2000}{0.73435} = 2723.5\text{ kN}$.

 8. **Kiểm tra ép vỡ bê tông:**

    * $\nu' = 1 - \frac{25}{250} = 0.90 \implies \sigma_{Rd,max} = 0.6 \times 0.90 \times 14.5 = 7.83\text{ MPa}$.

    * $A_p = 282743.3\text{ mm}^2 \implies A_{strut,i} = 207632.6\text{ mm}^2$.

    * $\sigma_{c,strut,i} = \frac{2723.5 \times 10^3}{207632.6} = 13.12\text{ MPa} > 7.83\text{ MPa}$ $\implies$ Kích hoạt cảnh báo `CRUSHING_WARNING` (Thanh chống 3D chuyển sang màu đỏ).

 9. **Lực kéo bứt tách vuông góc trục thanh chống (**$T_{burst,\perp,i}$**):**

    * $b_{ef,i} = 600 \times 0.73435 = 440.61\text{ mm}$.

    * $H_{ef,i} = \frac{1562.61}{2} = 781.31\text{ mm}$.

    * Do $\frac{b_{ef,i}}{H_{ef,i}} = 0.5639 > 0.5$:

      $$
      T_{burst,\perp,i} = 0.25 \cdot (1 - 0.7 \times 0.5639) \cdot 2723.5 = 412.11\text{ kN}
      $$

10. **Lực kéo bứt tách quy đổi về mặt phẳng ngang cho 1 thanh chống:**

    $$
    T_{burst,h,i} = \frac{412.11}{0.73435} = 561.19\text{ kN}
    $$

11. **Chiếu lên phương** $X$ **và** $Y$ **(**$\cos \alpha_i = \sin \alpha_i = 0.7071$**):**

    $$
    T_{burst,x,i} = T_{burst,y,i} = 561.19 \times 0.7071 = 396.82\text{ kN}
    $$

12. **Tổng lực kéo ngang thiết kế qua mặt cắt đài (gồm 2 thanh chống mỗi phía):**

    $$
    T_{design,X} = T_{design,Y} = 2 \times 396.82 = 793.64\text{ kN}
    $$

13. **Diện tích cốt thép chống bứt tách yêu cầu:**

    $$
    A_{s,burst,X,req} = A_{s,burst,Y,req} = \frac{793.64 \times 10^3}{350} = 2267.5\text{ mm}^2 \quad (22.68\text{ cm}^2)
    $$

14. **Diện tích cốt thép cung cấp (`4 lớp x 4 nhánh phi 14`):**

    $$
    A_{s,burst,X,prov} = 4 \times 4 \times 153.94 = 2463.0\text{ mm}^2 \quad (24.63\text{ cm}^2)
    $$

15. **Hệ số sử dụng (**$UR$**):**

    $$
    UR_X = UR_Y = \frac{2267.5}{2463.0} = 0.921 \quad (92.1\% \le 100\% \implies \text{ĐẠT})
    $$