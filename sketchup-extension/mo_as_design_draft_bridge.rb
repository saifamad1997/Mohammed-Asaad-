# frozen_string_literal: true
# Mohammed Asaad CAD Bridge — DesignDraft v1 adapter for SketchUp Desktop
require 'sketchup.rb'
require 'json'

module MohammedAsaad
  module DesignDraftBridge
    extend self
    DICT = 'MohammedAsaadCADBridge'.freeze
    MENU = 'محمد أسعد | استيراد مسودة المهندس'.freeze
    PROTOCOL = 'mo-asaad.cad-bridge'.freeze

    def mm(value)
      Float(value).mm
    end

    def safe_name(value)
      value.to_s.strip.gsub(/[\\\\\/:*?"<>|]/, '-')[0, 80]
    end

    def dimension!(dims, key, label)
      value = dims[key]
      number = Float(value)
      raise "البعد #{label} يجب أن يكون أكبر من صفر." unless number.positive?
      number
    rescue TypeError, ArgumentError
      raise "البعد #{label} غير مكتمل أو غير رقمي."
    end

    def import_draft
      path = UI.openpanel('اختر مسودة المهندس JSON', '', 'JSON Files|*.json||')
      return unless path
      data = JSON.parse(File.read(path, encoding: 'UTF-8'))
      raise 'إصدار بروتوكول غير مدعوم.' unless data['protocol'] == PROTOCOL && data['version'].to_i == 1
      design = data.fetch('design')
      components = design['components']
      raise 'المسودة لا تحتوي عناصر.' unless components.is_a?(Array) && !components.empty?

      model = Sketchup.active_model
      model.start_operation('استيراد مسودة المهندس — محمد أسعد', true)
      root = model.entities.add_group
      root.name = safe_name(design['name'] || 'مسودة المهندس')
      root.set_attribute(DICT, 'protocol', PROTOCOL)
      root.set_attribute(DICT, 'version', 1)
      root.set_attribute(DICT, 'draft_id', data['draftId'].to_s)
      root.set_attribute(DICT, 'draft_status', data['status'].to_s)
      root.set_attribute(DICT, 'geometry_note', 'مكونات أولية؛ لا وصلات أو ثقوب أو اعتماد تصنيع')
      cursor_x = 0.mm
      gap = 100.mm
      created = 0
      skipped = []

      components.each do |item|
        dims = item['dimensions'] || {}
        begin
          width = dimension!(dims, 'width', 'العرض')
          depth = dimension!(dims, 'depth', 'العمق')
          height = dimension!(dims, 'height', 'الارتفاع')
          group = root.entities.add_group
          group.name = safe_name(item['name'] || item['role'] || 'عنصر')
          group.set_attribute(DICT, 'component_id', item['id'].to_s)
          group.set_attribute(DICT, 'role', item['role'].to_s)
          group.set_attribute(DICT, 'width_mm', width)
          group.set_attribute(DICT, 'depth_mm', depth)
          group.set_attribute(DICT, 'height_mm', height)
          pts = [
            Geom::Point3d.new(0, 0, 0), Geom::Point3d.new(mm(width), 0, 0),
            Geom::Point3d.new(mm(width), mm(depth), 0), Geom::Point3d.new(0, mm(depth), 0)
          ]
          face = group.entities.add_face(pts)
          raise 'تعذر إنشاء سطح العنصر.' unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(mm(height))
          group.transform!(Geom::Transformation.translation([cursor_x, 0, 0]))
          cursor_x += mm(width) + gap
          created += 1
        rescue StandardError => e
          skipped << "#{item['name'] || item['id']}: #{e.message}"
        end
      end

      raise 'لا توجد عناصر مكتملة الأبعاد لإنشاء هندسة.' if created.zero?
      model.commit_operation
      model.active_view.zoom_extents
      msg = "تم إنشاء #{created} عنصر ثلاثي الأبعاد من المسودة.\nهذه كتل أولية مرتبة بجانب بعضها وليست تجميعاً حقيقياً."
      msg += "\nعناصر لم تُنشأ بسبب نقص الأبعاد: #{skipped.join(' | ')}" unless skipped.empty?
      msg += "\nلا توجد وصلات أو ثقوب أو إكسسوارات أو موافقة تصنيع."
      UI.messagebox(msg)
    rescue StandardError => e
      model.abort_operation if model && model.active_operation?
      UI.messagebox("تعذر استيراد المسودة:\n#{e.message}")
    end

    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item(MENU) { import_draft }
      file_loaded(__FILE__)
    end
  end
end
