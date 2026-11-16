# frozen_string_literal: true
# محمد أسعد للتنجيد والتصميم الهندسي — SketchUp Bridge
# Imports project handoff JSON as individually named panel groups.
# Explicit XYZ places panel origins; this does not create joinery or a verified assembly.
require 'sketchup.rb'
require 'json'

module MohammedAsaad
  module SketchUpBridge
    extend self

    MENU_NAME = 'محمد أسعد | استيراد مشروع الشركة'.freeze
    DICT = 'MohammedAsaad'.freeze

    def mm(value)
      value.to_f.mm
    end

    def safe_name(value)
      value.to_s.strip.gsub(/[\\\\\/\:\*\?\"<>\|]/, '-')[0, 80]
    end

    def import_project
      model = nil
      operation_started = false
      path = UI.openpanel('اختر ملف مشروع الشركة JSON', '', 'JSON Files|*.json||')
      return unless path

      data = JSON.parse(File.read(path, encoding: 'UTF-8'))
      project = data.fetch('project')
      catalog = project['manufacturing_catalog'] || project.dig('design_data', 'manufacturing_catalog')
      raise 'لا يحتوي الملف على كتالوج تصنيع. افتح الكتالوج واحفظه ثم أعد التصدير.' unless catalog.is_a?(Hash)

      parts = catalog['parts']
      raise 'قائمة القطع فارغة.' unless parts.is_a?(Array) && !parts.empty?

      board = catalog['board'] || {}
      thickness = board['thickness'].to_f
      raise 'سماكة اللوح غير محددة.' unless thickness.positive?

      model = Sketchup.active_model
      model.start_operation('استيراد مشروع محمد أسعد', true)
      operation_started = true
      root = model.entities.add_group
      root.name = safe_name("مشروع #{project['project_no']} - #{project['title']}")
      root.set_attribute(DICT, 'source', 'MohammedAsaad project JSON')
      root.set_attribute(DICT, 'project_no', project['project_no'].to_s)
      root.set_attribute(DICT, 'catalog_version', catalog['version'].to_i)
      root.set_attribute(DICT, 'placement_coordinate_system', 'global-origin-lower-left-panel-plane; X=panel-width, Y=panel-height, Z=board-thickness')

      placed_mode = parts.all? do |part|
        pos = part['position']
        qty_value = Float(part['qty']) rescue 0
        part['width'].to_f.positive? && part['height'].to_f.positive? && qty_value == 1 &&
          pos.is_a?(Hash) && %w[x y z].all? { |axis| pos.key?(axis) && !pos[axis].nil? && pos[axis].to_s != '' }
      end
      parts_group = root.entities.add_group
      parts_group.name = placed_mode ? 'ألواح بمواضع XYZ المدخلة — دون وصلات' : 'قائمة القطع — عرض منفصل غير مركب'
      spacing = 80.mm
      cursor_x = 0.mm
      cursor_y = 0.mm
      row_depth = 0.mm
      max_row_width = 2400.mm
      created = 0

      parts.each do |part|
        width = part['width'].to_f
        height = part['height'].to_f
        qty_value = Float(part['qty']) rescue 0
        next unless width.positive? && height.positive? && qty_value.positive? && qty_value == qty_value.to_i
        qty = qty_value.to_i

        qty.times do |index|
          w = mm(width)
          h = mm(height)
          t = mm(thickness)
          if cursor_x + w > max_row_width
            cursor_x = 0.mm
            cursor_y += row_depth + spacing
            row_depth = 0.mm
          end

          component = parts_group.entities.add_group
          component.name = safe_name("#{part['name']} #{index + 1}")
          component.set_attribute(DICT, 'part_name', part['name'].to_s)
          component.set_attribute(DICT, 'width_mm', width)
          component.set_attribute(DICT, 'height_mm', height)
          component.set_attribute(DICT, 'thickness_mm', thickness)
          component.set_attribute(DICT, 'quantity_index', index + 1)

          pts = [
            Geom::Point3d.new(0, 0, 0),
            Geom::Point3d.new(w, 0, 0),
            Geom::Point3d.new(w, h, 0),
            Geom::Point3d.new(0, h, 0)
          ]
          face = component.entities.add_face(pts)
          raise "تعذر إنشاء القطعة: #{part['name']}" unless face
          face.reverse! if face.normal.z < 0
          face.pushpull(t)
          if placed_mode
            pos = part['position']
            origin = Geom::Point3d.new(mm(pos['x']), mm(pos['y']), mm(pos['z']))
            angle = part.dig('rotation', 'z').to_f.degrees
            transform = Geom::Transformation.translation(origin) * Geom::Transformation.rotation(ORIGIN, Z_AXIS, angle)
            component.transform!(transform)
            component.set_attribute(DICT, 'position_x_mm', pos['x'].to_f)
            component.set_attribute(DICT, 'position_y_mm', pos['y'].to_f)
            component.set_attribute(DICT, 'position_z_mm', pos['z'].to_f)
            component.set_attribute(DICT, 'rotation_z_degrees', part.dig('rotation', 'z').to_f)
          else
            component.transform!(Geom::Transformation.translation([cursor_x, cursor_y, 0]))
            cursor_x += w + spacing
            row_depth = [row_depth, h].max
          end
          created += 1
        end
      end

      raise 'لم يتم إنشاء أي قطع صالحة.' if created.zero?
      model.commit_operation
      operation_started = false
      model.active_view.zoom_extents
      UI.messagebox(placed_mode ? "تم استيراد #{created} قطعة وفق مواضع XYZ والدوران Z المدخلة.\nهذا نموذج ألواح بمواضعها فقط؛ X عرض اللوح وY ارتفاعه وZ سماكته. لا توجد وصلات أو ثقوب أو إكسسوارات محسوبة." : "تم استيراد #{created} مكوّناً في ترتيب منفصل حسب قائمة القص.\nلم تكتمل مواضع XYZ لكل القطع، لذلك لم يتم إنشاء تجميع.")
    rescue StandardError => e
      model.abort_operation if model && operation_started
      UI.messagebox("تعذر الاستيراد:\n#{e.message}")
    end

    unless file_loaded?(__FILE__)
      UI.menu('Extensions').add_item(MENU_NAME) { import_project }
      file_loaded(__FILE__)
    end
  end
end
